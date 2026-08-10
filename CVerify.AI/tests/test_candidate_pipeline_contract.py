import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
from pydantic import ValidationError
from app.pipelines.candidate.context import PipelineContext, CvSkill, MappedSkill, SkillTreeNode

class TestCandidatePipelineContract(unittest.TestCase):
    def setUp(self):
        self.base_cv = {
            "cvId": "test-cv-123",
            "skills": [],
            "experiences": [],
            "projects": []
        }

    def test_cv_skills_normalization_strings(self):
        """Verifies that a list of raw strings is normalized into CvSkill objects."""
        context = PipelineContext(
            cv=self.base_cv,
            repositoryAssessments=[],
            cvSkills=["Python", "React JS"]
        )
        self.assertEqual(len(context.cvSkills), 2)
        
        python_skill = context.cvSkills[0]
        self.assertIsInstance(python_skill, CvSkill)
        self.assertEqual(python_skill.originalName, "Python")
        self.assertEqual(python_skill.normalizedName, "Python")
        self.assertTrue(python_skill.skillId.startswith("skill:emerging-"))

        react_skill = context.cvSkills[1]
        self.assertEqual(react_skill.originalName, "React JS")
        self.assertEqual(react_skill.normalizedName, "React JS")
        self.assertTrue(react_skill.skillId.startswith("skill:emerging-"))

    def test_cv_skills_normalization_dicts(self):
        """Verifies that a list of dictionaries matching CvSkill schema is parsed directly."""
        context = PipelineContext(
            cv=self.base_cv,
            repositoryAssessments=[],
            cvSkills=[
                {
                    "originalName": "Python",
                    "normalizedName": "Python",
                    "skillId": "skill:canonical-python"
                },
                {
                    "originalName": "React JS",
                    "normalizedName": "React",
                    "skillId": "skill:canonical-react"
                }
            ]
        )
        self.assertEqual(len(context.cvSkills), 2)
        self.assertEqual(context.cvSkills[0].skillId, "skill:canonical-python")
        self.assertEqual(context.cvSkills[1].normalizedName, "React")

    def test_cv_skills_normalization_mixed(self):
        """Verifies that a list containing both raw strings and dictionaries is parsed successfully."""
        context = PipelineContext(
            cv=self.base_cv,
            repositoryAssessments=[],
            cvSkills=[
                "C#",
                {
                    "originalName": "React JS",
                    "normalizedName": "React",
                    "skillId": "skill:canonical-react"
                }
            ]
        )
        self.assertEqual(len(context.cvSkills), 2)
        self.assertEqual(context.cvSkills[0].originalName, "C#")
        self.assertTrue(context.cvSkills[0].skillId.startswith("skill:emerging-"))
        self.assertEqual(context.cvSkills[1].skillId, "skill:canonical-react")

    def test_skill_tree_single_root_dict(self):
        """Verifies that a single root node dictionary is validated into a SkillTreeNode."""
        tree_payload = {
            "id": "software-engineering",
            "parentId": None,
            "displayName": "Software Engineering",
            "category": "Domain",
            "proficiencyLevel": "Expert",
            "confidenceScore": 0.95,
            "estimatedExperience": 48.0,
            "children": [
                {
                    "id": "software-engineering/backend",
                    "parentId": "software-engineering",
                    "displayName": "Backend Development",
                    "category": "Subdomain",
                    "proficiencyLevel": "Practitioner",
                    "confidenceScore": 0.9,
                    "estimatedExperience": 36.0,
                    "children": []
                }
            ]
        }

        context = PipelineContext(
            cv=self.base_cv,
            repositoryAssessments=[],
            skillTree=tree_payload
        )
        self.assertIsInstance(context.skillTree, SkillTreeNode)
        self.assertEqual(context.skillTree.id, "software-engineering")
        self.assertEqual(len(context.skillTree.children), 1)
        self.assertEqual(context.skillTree.children[0].id, "software-engineering/backend")

    def test_skill_tree_multi_root_list(self):
        """Verifies that a list of root node dictionaries is validated into a List[SkillTreeNode]."""
        tree_payload = [
            {
                "id": "software-engineering",
                "parentId": None,
                "displayName": "Software Engineering",
                "category": "Domain",
                "proficiencyLevel": "Expert",
                "confidenceScore": 0.95,
                "estimatedExperience": 48.0,
                "children": []
            },
            {
                "id": "project-management",
                "parentId": None,
                "displayName": "Project Management",
                "category": "Domain",
                "proficiencyLevel": "Awareness",
                "confidenceScore": 0.5,
                "estimatedExperience": 12.0,
                "children": []
            }
        ]

        context = PipelineContext(
            cv=self.base_cv,
            repositoryAssessments=[],
            skillTree=tree_payload
        )
        self.assertIsInstance(context.skillTree, list)
        self.assertEqual(len(context.skillTree), 2)
        self.assertIsInstance(context.skillTree[0], SkillTreeNode)
        self.assertEqual(context.skillTree[0].id, "software-engineering")
        self.assertEqual(context.skillTree[1].id, "project-management")

if __name__ == "__main__":
    unittest.main()
