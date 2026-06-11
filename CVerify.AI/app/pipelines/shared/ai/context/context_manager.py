import os
import re
import ast
import logging
from typing import List, Dict, Any

logger = logging.getLogger("context_manager")

class ContextManager:
    """
    Subsystem responsible for AST pruning, semantic chunking, and handling large files
    to optimize token usage within LLM context windows.
    """

    @staticmethod
    def prune_python_ast(content: str) -> str:
        """
        Parses python source code and prunes function/method bodies,
        leaving only signatures, class hierarchies, and docstrings.
        """
        try:
            tree = ast.parse(content)
            
            class PythonPruner(ast.NodeTransformer):
                def visit_FunctionDef(self, node):
                    # Keep decorators, name, args, returns, and docstring, but empty the body.
                    docstring = ast.get_docstring(node)
                    new_body = []
                    if docstring:
                        new_body.append(ast.Expr(value=ast.Constant(value=docstring)))
                    new_body.append(ast.Pass())
                    node.body = new_body
                    return node

                def visit_AsyncFunctionDef(self, node):
                    return self.visit_FunctionDef(node)

            pruned_tree = PythonPruner().visit(tree)
            return ast.unparse(pruned_tree)
        except Exception as e:
            logger.debug(f"Python AST pruning failed, falling back to line-based pruning: {e}")
            return ContextManager.prune_c_style_structure(content)

    @staticmethod
    def prune_c_style_structure(content: str) -> str:
        """
        Uses curly-brace nesting analysis to prune function and method bodies
        while keeping class structures and member signatures.
        """
        lines = content.splitlines()
        pruned_lines = []
        brace_count = 0
        in_pruned_block = False
        block_start_brace = 0
        
        # Matches signatures for classes, interfaces, methods, functions
        signature_pat = re.compile(
            r"\b(class|interface|struct|enum|fn|func|function|public|private|protected|internal|static|async|void)\b"
        )
        class_pat = re.compile(r"\b(class|interface|struct|enum)\b")
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
                
            opens = stripped.count('{')
            closes = stripped.count('}')
            
            prev_brace_count = brace_count
            brace_count += opens - closes
            
            if not in_pruned_block:
                # If we detect a function/class signature
                if signature_pat.search(stripped):
                    pruned_lines.append(line)
                    if opens > 0:
                        if class_pat.search(stripped):
                            # It's a class/interface, don't prune its body, just keep parsing
                            pass
                        else:
                            # It's a function/method, prune its body
                            in_pruned_block = True
                            block_start_brace = prev_brace_count
                else:
                    # Keep other lines at low brace levels (e.g. fields, properties)
                    if brace_count <= 2:
                        pruned_lines.append(line)
            else:
                # We are inside a block we want to prune.
                # If we're at or below the start brace level, we exited the block.
                if brace_count <= block_start_brace:
                    in_pruned_block = False
                    pruned_lines.append(line)  # Keep the closing line/brace
                    
        return "\n".join(pruned_lines)

    @staticmethod
    def prune_file(file_path: str, content: str) -> str:
        """
        Selects the appropriate AST/structural pruner based on the file extension.
        """
        _, ext = os.path.splitext(file_path.lower())
        
        if ext == '.py':
            return ContextManager.prune_python_ast(content)
        elif ext in ('.cs', '.ts', '.tsx', '.js', '.jsx', '.go', '.java', '.cpp', '.h'):
            return ContextManager.prune_c_style_structure(content)
        else:
            # For non-code files, return as-is
            return content

    @staticmethod
    def semantic_chunk(content: str, max_chunk_size: int = 4000) -> List[str]:
        """
        Splits file content into structural chunks based on function/class boundaries
        rather than simple character/line counts.
        """
        lines = content.splitlines()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for line in lines:
            current_chunk.append(line)
            current_size += len(line) + 1
            
            # Split if we exceed target size and we are at a natural boundary (empty line or brace closure)
            if current_size >= max_chunk_size:
                stripped = line.strip()
                if not stripped or stripped == '}' or stripped == ']':
                    chunks.append("\n".join(current_chunk))
                    current_chunk = []
                    current_size = 0
                    
        if current_chunk:
            chunks.append("\n".join(current_chunk))
            
        return chunks
