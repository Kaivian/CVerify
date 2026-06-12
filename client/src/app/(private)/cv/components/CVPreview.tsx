import React from "react";
import { Phone, Mail, MapPin, Calendar, Link2 } from "lucide-react";
import { useCvPagination, type LayoutBlock } from "../hooks/use-cv-pagination";

const GitHubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3" {...props}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

// Format date to MM/YYYY
const formatMonthYear = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  } catch {
    return dateStr;
  }
};

interface CVPreviewProps {
  basic: Record<string, any>;
  summary: Record<string, any>;
  skills: Record<string, any>;
  experience: Record<string, any>[];
  education: Record<string, any>[];
  achievements: Record<string, any>[];
  preferences: Record<string, any>;
  projects?: Record<string, any>[];
}

// ---------------------------------------------------------
// Sub-components mapped to LayoutBlock.type
// ---------------------------------------------------------

const CvHeader: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  const renderSocialIcon = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes("github.com")) return <GitHubIcon className="size-3 text-neutral-600 shrink-0" />;
    if (lower.includes("linkedin.com")) return <LinkedInIcon className="size-3 text-neutral-600 shrink-0" />;
    return <Link2 className="size-3 text-neutral-600 shrink-0" />;
  };

  const formatSocialLink = (url: string): string => {
    if (!url) return "";
    return url.replace(/^(https?:\/\/)?(www\.)?/, "");
  };

  return (
    <div className="flex flex-col text-left gap-1.5 pb-4 w-full min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 uppercase w-full">
        {data.fullName || "Untitled"}
      </h1>
      {data.headline && (
        <div className="flex items-center gap-1.5 flex-wrap w-full">
          <span className="text-[11px] font-bold text-accent tracking-wider uppercase">
            {data.headline}
          </span>
          {data.isAiHeadline && (
            <div className="inline-flex items-center gap-1 select-none shrink-0 normal-case">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black tracking-wider uppercase border border-emerald-200/50">
                AI
              </span>
              {data.matchScore !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[8px] font-bold border border-accent/20">
                  {data.matchScore}% Match
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contact Details Grid */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] text-neutral-700 max-w-full min-w-0">
        {data.phoneNumber && (
          <span className="flex items-center gap-1 min-w-0">
            <Phone className="size-3 text-neutral-600 shrink-0" />
            {data.phoneNumber}
          </span>
        )}
        {data.publicEmail && (
          <span className="flex items-center gap-1 min-w-0">
            <Mail className="size-3 text-neutral-600 shrink-0" />
            {data.publicEmail}
          </span>
        )}
        {data.birthDate && (
          <span className="flex items-center gap-1 min-w-0">
            <Calendar className="size-3 text-neutral-600 shrink-0" />
            {formatMonthYear(data.birthDate)}
          </span>
        )}
        {data.location && (
          <span className="flex items-center gap-1 min-w-0">
            <MapPin className="size-3 text-neutral-600 shrink-0" />
            {data.location}
          </span>
        )}
        {data.socialLinks && data.socialLinks.map((link: string, idx: number) => (
          <a
            key={idx}
            href={link.startsWith("http") ? link : `https://${link}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:underline text-neutral-700 min-w-0"
          >
            {renderSocialIcon(link)}
            {formatSocialLink(link)}
          </a>
        ))}
      </div>
    </div>
  );
};

const CvSectionTitle: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  return (
    <div className="flex flex-col gap-1 text-left w-full mt-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <h2 className="font-extrabold text-[11px] uppercase tracking-widest text-accent">
          {data.title}
        </h2>
        {data.isAi && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black tracking-wider border border-emerald-200/50 select-none normal-case leading-none">
            AI
          </span>
        )}
      </div>
      <div className="border-b border-separator/60 w-full mt-0.5" />
    </div>
  );
};

const CvParagraph: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  return (
    <p className={`text-neutral-700 leading-relaxed font-normal text-[10.5px] whitespace-pre-wrap text-left ${data.isItalic ? "italic text-neutral-600" : ""}`}>
      {data.text}
    </p>
  );
};

const CvBulletPoint: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  if (data.isSubheading) {
    return (
      <div className="text-[10px] font-bold text-neutral-800 uppercase tracking-wide text-left mt-1 pl-1">
        {data.text}
      </div>
    );
  }

  if (data.isLink) {
    return (
      <div className="flex items-center gap-1 text-[10px] pl-1 text-left">
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="text-neutral-600 hover:underline flex items-center gap-0.5"
        >
          <Link2 className="size-2.5" />
          {data.text}
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 pl-1 text-left text-[10.5px] text-neutral-700 leading-relaxed">
      {data.isCircle ? (
        <span className="text-[10px] text-neutral-400 select-none pt-0.5">○</span>
      ) : (
        <span className="text-[10px] text-neutral-400 select-none pt-0.5">•</span>
      )}
      <div className="flex-1">
        {data.prefix && <span className="font-semibold text-neutral-900">{data.prefix}: </span>}
        {data.text}
      </div>
    </div>
  );
};

const CvEntryHeader: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  const renderVerificationBadge = (level: number, status: number) => {
    if (level === 1) { // AI Analyzed
      if (status === 2) {
        return (
          <span className="cv-badge text-[7.5px] font-extrabold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 select-none uppercase tracking-wide">
            AI • Outdated
          </span>
        );
      }
      if (status === 3) {
        return (
          <span className="cv-badge text-[7.5px] font-extrabold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 select-none uppercase tracking-wide">
            AI • Disconnected
          </span>
        );
      }
      return (
        <span className="cv-badge text-[7.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/50 select-none uppercase tracking-wide">
          AI Verified
        </span>
      );
    }
    if (level === 2) { // Repo Linked
      if (status === 3) {
        return (
          <span className="cv-badge text-[7.5px] font-extrabold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 select-none uppercase tracking-wide">
            Repo • Disconnected
          </span>
        );
      }
      return (
        <span className="cv-badge text-[7.5px] font-extrabold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200/50 select-none uppercase tracking-wide">
          Repo Linked
        </span>
      );
    }
    return (
      <span className="cv-badge text-[7.5px] font-extrabold text-neutral-600 bg-neutral-50 px-1 py-0.5 rounded border border-neutral-200/50 select-none uppercase tracking-wide">
        Self Declared
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-0.5 w-full mt-1.5">
      <div className="flex items-start justify-between font-bold text-neutral-900 text-[11px] text-left">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{data.title}</span>
          {data.verificationLevel !== undefined &&
            renderVerificationBadge(data.verificationLevel, data.verificationStatus)}
        </div>
        <span className="text-[10px] text-neutral-500 font-semibold shrink-0 pl-4 select-none">
          {data.dateRange}
        </span>
      </div>
      {(data.subtitle || data.rightSubtitle) && (
        <div className="flex items-center justify-between text-neutral-600 text-[10px] font-medium italic">
          <span>{data.subtitle}</span>
          {data.rightSubtitle && <span className="font-semibold text-neutral-700 pl-4">{data.rightSubtitle}</span>}
        </div>
      )}
    </div>
  );
};

const CvTechList: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  if (data.categorizedSkills) {
    return (
      <div className="flex flex-col gap-1 mt-1 text-[10.5px] text-neutral-800 text-left">
        {Object.entries(data.categorizedSkills as Record<string, string[]>).map(([category, items]) => (
          <div key={category} className="leading-relaxed">
            <span className="font-semibold text-neutral-800">{category}:</span>{" "}
            <span className="text-neutral-700">{items.join(", ")}</span>
          </div>
        ))}
      </div>
    );
  }

  if (data.items) {
    return (
      <div className="text-[10px] text-neutral-600 mt-0.5 pl-1 text-left">
        <span className="font-semibold text-neutral-800">{data.label}:</span>{" "}
        {data.items.join(", ")}
      </div>
    );
  }

  return (
    <div className="text-[10.5px] text-neutral-700 leading-relaxed text-left pl-1">
      {data.flatSkills?.join(", ")}
    </div>
  );
};

const CvPreferencesGrid: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  const pref = data.preferences;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-1 text-[10px] text-neutral-700 text-left">
      {pref.openToWorkStatus && (
        <div>
          <span className="font-bold text-neutral-900">Job Search Status:</span>{" "}
          <span>
            {pref.openToWorkStatus === "active"
              ? "Active Job Search"
              : pref.openToWorkStatus === "casual"
                ? "Casual Browsing"
                : "Not Open to Work"}
          </span>
        </div>
      )}
      {pref.desiredJobPositions && pref.desiredJobPositions.length > 0 && (
        <div>
          <span className="font-bold text-neutral-900">Target Roles:</span>{" "}
          <span>{pref.desiredJobPositions.join(", ")}</span>
        </div>
      )}
      {(pref.expectedSalaryMin || pref.expectedSalaryMax) && (
        <div>
          <span className="font-bold text-neutral-900">Expected Salary:</span>{" "}
          <span>
            {pref.expectedSalaryNegotiable
              ? "Negotiable"
              : `${pref.expectedSalaryMin?.toLocaleString() || "0"} - ${pref.expectedSalaryMax?.toLocaleString() || "Any"} ${pref.expectedSalaryCurrency || "USD"} (${pref.expectedSalaryType || "Monthly"})`}
          </span>
        </div>
      )}
      {pref.remotePreference && (
        <div>
          <span className="font-bold text-neutral-900">Work Arrangement:</span>{" "}
          <span className="capitalize">{pref.remotePreference}</span>
        </div>
      )}
      {pref.preferredLocations && pref.preferredLocations.length > 0 && (
        <div>
          <span className="font-bold text-neutral-900">Desired Locations:</span>{" "}
          <span>{pref.preferredLocations.join(", ")}</span>
        </div>
      )}
      {pref.employmentPreferences && pref.employmentPreferences.length > 0 && (
        <div>
          <span className="font-bold text-neutral-900">Employment Types:</span>{" "}
          <span className="capitalize">{pref.employmentPreferences.join(", ")}</span>
        </div>
      )}
      {pref.workPreferenceNotes && (
        <div className="col-span-2 mt-0.5">
          <span className="font-bold text-neutral-900">Work Preference Notes:</span>{" "}
          <span className="italic">{pref.workPreferenceNotes}</span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// Template Block Mapper Component
// ---------------------------------------------------------

const CvBlockRenderer: React.FC<{ block: LayoutBlock }> = ({ block }) => {
  switch (block.type) {
    case "header":
      return <CvHeader data={block.data} />;
    case "section-title":
      return <CvSectionTitle data={block.data} />;
    case "paragraph":
      return <CvParagraph data={block.data} />;
    case "bullet-point":
      return <CvBulletPoint data={block.data} />;
    case "entry-header":
      return <CvEntryHeader data={block.data} />;
    case "tech-list":
      return <CvTechList data={block.data} />;
    case "preferences-grid":
      return <CvPreferencesGrid data={block.data} />;
    default:
      return null;
  }
};

// ---------------------------------------------------------
// Main CVPreview Component
// ---------------------------------------------------------

export const CVPreview: React.FC<CVPreviewProps> = (props) => {
  const { pages, isReady, measurerRef, blocks, uniqueId } = useCvPagination(props);

  const measurerDiv = (
    <div
      ref={measurerRef}
      className="absolute top-[-9999px] left-[-9999px] w-[794px] opacity-0 pointer-events-none select-none flex flex-col gap-3 p-[20mm] box-border bg-white text-black font-sans text-xs cv-measurer"
    >
      {blocks.map((block) => (
        <div key={block.id} id={`${uniqueId}-measurer-${block.id}`}>
          <CvBlockRenderer block={block} />
        </div>
      ))}
    </div>
  );

  // Fallback / Initial Hydration Loading
  if (!isReady || pages.length === 0) {
    return (
      <>
        {measurerDiv}
        <div className="w-[210mm] h-[297mm] bg-white border border-border flex flex-col items-center justify-center rounded-xs shadow-md">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Generating Preview...</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        /* Screen styles for the print portal: keep it rendering but off-screen so pagination runs and measures correctly */
        .cv-print-portal {
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
          width: 794px !important;
          height: auto !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -9999 !important;
        }
        @media print {
          /* Reset transitions, animations, and transforms on print portal descendants to prevent parent scaling leaks */
          * {
            transform: none !important;
            transform-origin: initial !important;
            transition: none !important;
            animation: none !important;
          }

          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide all app contents when printing */
          body > :not(.cv-print-portal) {
            display: none !important;
          }

          /* Explicitly display and style only the print portal root */
          .cv-print-portal {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            height: auto !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            z-index: 999999 !important;
          }

          .cv-print-area {
            display: block !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .cv-page {
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: 297mm !important;
            width: 210mm !important;
            padding: 20mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: white !important;
          }

          .cv-measurer {
            display: none !important;
          }
        }
      `}</style>

      {/* Hidden Measurer Container - Sibling to cv-print-area so it is automatically hidden on print */}
      {measurerDiv}

      <div className="cv-print-area flex flex-col gap-6 items-center w-full">
        {/* Paginated Pages */}
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            className="cv-page w-[210mm] h-[297mm] bg-white text-black p-[20mm] box-border relative flex flex-col justify-between shadow-md border border-border select-text"
          >
            {/* Page content */}
            <div className="flex flex-col gap-3 grow">
              {page.blocks.map((block) => (
                <div key={block.id} className="cv-block">
                  <CvBlockRenderer block={block} />
                </div>
              ))}
            </div>

            {/* Footer Area on each page */}
            <div className="cv-footer flex justify-between items-center text-[8.5px] text-neutral-500 border-t border-neutral-200 pt-2 font-sans select-none print:border-neutral-300">
              <span>Verified by CVerify • AI-assisted candidate profile authentication</span>
              <span>
                Page {page.pageNumber} of {page.totalPages}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
