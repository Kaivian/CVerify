import React from "react";
import { Chip, Button } from "@heroui/react";
import { Crown, Sparkles, Printer, FileDown } from "lucide-react";

interface CvSummaryViewProps {
  report: {
    cvSynthesis?: {
      title: string;
      ownershipProfile?: string;
      summary: string;
      skills?: string[];
      highlights?: {
        signal: string;
        impact: string;
      }[];
    };
  };
}

// Heuristics to detect if CV data is in Vietnamese
const isVietnameseText = (text: string): boolean => {
  if (!text) return false;
  const viRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return viRegex.test(text);
};

export const CvSummaryView: React.FC<CvSummaryViewProps> = ({ report }) => {
  if (!report?.cvSynthesis) return null;
  const cv = report.cvSynthesis;

  const isVi = isVietnameseText(cv.summary) || isVietnameseText(cv.title);
  const labels = isVi ? {
    title: "Chức danh Chuyên môn",
    ownership: "Hồ sơ Đóng góp",
    summary: "Tóm tắt Điều hành",
    skills: "Kỹ năng Kỹ thuật Cốt lõi",
    highlights: "Đóng góp & Điểm nhấn Chính",
    downloadPdf: "Tải PDF",
    downloadMd: "Tải Markdown",
  } : {
    title: "Professional Title",
    ownership: "Ownership Profile",
    summary: "Executive Summary",
    skills: "Core Technical Skills",
    highlights: "Key Contributions & Highlights",
    downloadPdf: "Download PDF",
    downloadMd: "Download Markdown",
  };

  const getOwnershipProfileClasses = (profile: string) => {
    switch (profile) {
      case "High contribution profile":
        return "bg-success/15 text-success border border-success/20";
      case "Standard contribution profile":
        return "bg-accent/15 text-accent border border-accent/20";
      case "Low contribution profile":
        return "bg-warning/15 text-warning border border-warning/20";
      case "External contributor context":
      default:
        return "bg-danger/15 text-danger border border-danger/20";
    }
  };

  const handleDownloadMarkdown = () => {
    let md = `# ${cv.title}\n\n`;
    if (cv.ownershipProfile) {
      md += `**${labels.ownership}**: ${cv.ownershipProfile}\n\n`;
    }
    md += `## ${labels.summary}\n${cv.summary}\n\n`;

    if (cv.skills && cv.skills.length > 0) {
      md += `## ${labels.skills}\n`;
      md += cv.skills.map((s: string) => `- ${s}`).join("\n") + "\n\n";
    }

    if (cv.highlights && cv.highlights.length > 0) {
      md += `## ${labels.highlights}\n`;
      md += cv.highlights.map((h: { signal: string; impact: string }) => `* **${h.signal}**: ${h.impact}`).join("\n") + "\n";
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CV_${cv.title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    let stylesHtml = "";
    for (const styleSheet of Array.from(document.styleSheets)) {
      try {
        if (styleSheet.href) {
          stylesHtml += `<link rel="stylesheet" href="${styleSheet.href}">`;
        } else {
          const cssRules = Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join("\n");
          stylesHtml += `<style>${cssRules}</style>`;
        }
      } catch {
        // Ignore cross-origin stylesheet errors
      }
    }

    const contentHtml = `
      <html>
        <head>
          <title>CV_${cv.title.replace(/\s+/g, "_")}</title>
          ${stylesHtml}
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            body {
              background: white !important;
              color: #111827 !important;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .cv-container {
              max-width: 800px;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              gap: 24px;
            }
            .card {
              border: 1px solid #e5e7eb;
              background: #ffffff;
              border-radius: 12px;
              padding: 20px;
            }
            .badge {
              background-color: #f3f4f6;
              color: #1f2937;
              border: 1px solid #e5e7eb;
              padding: 4px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              display: inline-block;
            }
            .badge-success {
              background-color: rgba(16, 185, 129, 0.1) !important;
              color: #059669 !important;
              border-color: rgba(16, 185, 129, 0.2) !important;
            }
            .badge-accent {
              background-color: rgba(99, 102, 241, 0.1) !important;
              color: #4f46e5 !important;
              border-color: rgba(99, 102, 241, 0.2) !important;
            }
            .badge-warning {
              background-color: rgba(245, 158, 11, 0.1) !important;
              color: #d97706 !important;
              border-color: rgba(245, 158, 11, 0.2) !important;
            }
            .badge-danger {
              background-color: rgba(239, 68, 68, 0.1) !important;
              color: #dc2626 !important;
              border-color: rgba(239, 68, 68, 0.2) !important;
            }
          </style>
        </head>
        <body>
          <div class="cv-container">
            <!-- Header -->
            <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 4px;">
                  ${labels.title}
                </div>
                <h3 style="font-size: 18px; font-weight: 900; margin: 0; color: #111827; text-transform: capitalize;">
                  👑 ${cv.title}
                </h3>
              </div>
              ${cv.ownershipProfile ? `
              <div style="text-align: right;">
                <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 4px;">
                  ${labels.ownership}
                </div>
                <span class="badge ${
                  cv.ownershipProfile === "High contribution profile" ? "badge-success" :
                  cv.ownershipProfile === "Standard contribution profile" ? "badge-accent" :
                  cv.ownershipProfile === "Low contribution profile" ? "badge-warning" : "badge-danger"
                }">
                  ${cv.ownershipProfile}
                </span>
              </div>
              ` : ""}
            </div>

            <!-- Summary -->
            <div class="card">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 8px;">
                ${labels.summary}
              </div>
              <p style="font-size: 12px; color: #374151; line-height: 1.6; margin: 0; font-weight: 300; white-space: pre-wrap;">
                ${cv.summary}
              </p>
            </div>

            <!-- Skills -->
            ${cv.skills && cv.skills.length > 0 ? `
            <div class="card">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 8px;">
                ${labels.skills}
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${cv.skills.map((s: string) => `<span class="badge">${s}</span>`).join("")}
              </div>
            </div>
            ` : ""}

            <!-- Highlights -->
            ${cv.highlights && cv.highlights.length > 0 ? `
            <div class="card">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 12px;">
                ${labels.highlights}
              </div>
              <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px;">
                ${cv.highlights.map((h: { signal: string; impact: string }) => `
                  <li style="display: flex; gap: 8px; font-size: 12px; align-items: flex-start;">
                    <span style="color: #6366f1; margin-top: 2px;">✦</span>
                    <div>
                      <strong style="color: #111827; display: block; margin-bottom: 2px; font-weight: 700;">${h.signal}</strong>
                      <p style="color: #4b5563; margin: 0; line-height: 1.6; font-weight: 300;">${h.impact}</p>
                    </div>
                  </li>
                `).join("")}
              </ul>
            </div>
            ` : ""}
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(contentHtml);
    doc.close();

    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };

    iframe.contentWindow?.addEventListener("afterprint", cleanup);

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print failed:", err);
        cleanup();
      }
    }, 500);
  };

  return (
    <div className="flex flex-col gap-6 text-left font-sans w-full">
      {/* Export Controls */}
      <div className="flex justify-end items-center gap-2 -mb-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label={labels.downloadPdf}
          className="h-8 text-muted hover:text-foreground font-bold text-xs rounded-xl hover:bg-surface-secondary px-3 cursor-pointer"
          onClick={handlePrintPdf}
        >
          <Printer className="size-3.5" />
          <span>{labels.downloadPdf}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={labels.downloadMd}
          className="h-8 text-muted hover:text-foreground font-bold text-xs rounded-xl hover:bg-surface-secondary px-3 cursor-pointer"
          onClick={handleDownloadMarkdown}
        >
          <FileDown className="size-3.5" />
          <span>{labels.downloadMd}</span>
        </Button>
      </div>

      {/* CV Header Info */}
      <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            {labels.title}
          </span>
          <h3 className="text-lg font-black text-foreground capitalize flex items-center gap-2">
            <Crown className="size-4.5 text-warning shrink-0" />
            {cv.title}
          </h3>
        </div>
        {cv.ownershipProfile && (
          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              {labels.ownership}
            </span>
            <Chip
              size="sm"
              variant="soft"
              className={`h-6 text-[10px] font-extrabold uppercase rounded-lg px-2.5 ${getOwnershipProfileClasses(cv.ownershipProfile)}`}
            >
              {cv.ownershipProfile}
            </Chip>
          </div>
        )}
      </div>

      {/* Narrative Summary */}
      <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
        <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
          {labels.summary}
        </span>
        <p className="text-xs text-muted leading-relaxed font-light whitespace-pre-wrap">
          {cv.summary}
        </p>
      </div>

      {/* Skills Chips */}
      {cv.skills && cv.skills.length > 0 && (
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            {labels.skills}
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {cv.skills.map((skill: string, idx: number) => (
              <Chip
                key={`${skill}-${idx}`}
                size="sm"
                variant="soft"
                className="h-5.5 text-[10px] font-bold bg-surface-secondary text-foreground border border-border/60 rounded-md"
              >
                {skill}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Highlights Section */}
      {cv.highlights && cv.highlights.length > 0 && (
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            {labels.highlights}
          </span>
          <ul className="space-y-3 mt-1 pl-1">
            {cv.highlights.map((highlight: { signal: string; impact: string }, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-xs">
                <Sparkles className="size-3.5 text-accent shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-foreground font-bold leading-normal block">
                    {highlight.signal}
                  </strong>
                  <p className="text-muted leading-relaxed font-light">
                    {highlight.impact}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
export default CvSummaryView;
