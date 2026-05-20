import React from "react";
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Link2,
} from "lucide-react";
import { formatScore } from "@/lib/ai-score-mapper";

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

interface CVPreviewProps {
  basic: {
    fullName?: string;
    headline?: string;
    publicEmail?: string;
    phoneNumber?: string;
    location?: string;
    birthDate?: string;
    socialLinks?: string[];
  };
  summary: {
    bio?: string;
  };
  skills: {
    targetSkills?: string[];
  };
  experience: any[];
  education: any[];
  achievements: any[];
  preferences: {
    openToWorkStatus?: string;
    remotePreference?: string;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
    expectedSalaryCurrency?: string;
    expectedSalaryType?: string;
    expectedSalaryNegotiable?: boolean;
    isExpectedSalaryVisible?: boolean;
    desiredJobPositions?: string[];
    preferredLocations?: string[];
    employmentPreferences?: string[];
    workPreferenceNotes?: string;
  };
  projects?: any[];
}

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

// Helper to format social links for display (removes protocols)
const formatSocialLink = (url: string): string => {
  if (!url) return "";
  return url.replace(/^(https?:\/\/)?(www\.)?/, "");
};

// Helper to categorize flat skills list
const categorizeSkills = (skillsList: string[]): Record<string, string[]> => {
  const categories: Record<string, string[]> = {
    "Languages": [],
    "Frameworks & Libraries": [],
    "Databases & Cloud": [],
    "Tools & Platforms": [],
  };

  const keywords: Record<string, string> = {
    javascript: "Languages", typescript: "Languages", python: "Languages", java: "Languages",
    cpp: "Languages", "c++": "Languages", csharp: "Languages", "c#": "Languages",
    go: "Languages", golang: "Languages", rust: "Languages", php: "Languages",
    ruby: "Languages", swift: "Languages", kotlin: "Languages", sql: "Languages",
    html: "Languages", css: "Languages", bash: "Languages", shell: "Languages",
    
    react: "Frameworks & Libraries", reactjs: "Frameworks & Libraries", next: "Frameworks & Libraries",
    nextjs: "Frameworks & Libraries", vue: "Frameworks & Libraries", vuejs: "Frameworks & Libraries",
    angular: "Frameworks & Libraries", svelte: "Frameworks & Libraries", tailwind: "Frameworks & Libraries",
    "tailwind/css": "Frameworks & Libraries", tailwindcss: "Frameworks & Libraries", bootstrap: "Frameworks & Libraries",
    heroui: "Frameworks & Libraries", redux: "Frameworks & Libraries", spring: "Frameworks & Libraries",
    springboot: "Frameworks & Libraries", nestjs: "Frameworks & Libraries", express: "Frameworks & Libraries",
    expressjs: "Frameworks & Libraries", django: "Frameworks & Libraries", flask: "Frameworks & Libraries",
    fastapi: "Frameworks & Libraries",
    
    postgresql: "Databases & Cloud", mysql: "Databases & Cloud", mongodb: "Databases & Cloud",
    redis: "Databases & Cloud", sqlite: "Databases & Cloud", mariadb: "Databases & Cloud",
    firebase: "Databases & Cloud", oracle: "Databases & Cloud", aws: "Databases & Cloud",
    azure: "Databases & Cloud", gcp: "Databases & Cloud", kubernetes: "Databases & Cloud",
    k8s: "Databases & Cloud", docker: "Databases & Cloud",
    
    git: "Tools & Platforms", github: "Tools & Platforms", gitlab: "Tools & Platforms",
    cicd: "Tools & Platforms", "ci/cd": "Tools & Platforms", linux: "Tools & Platforms",
    nginx: "Tools & Platforms",
  };

  const others: string[] = [];

  skillsList.forEach((skill) => {
    const lower = skill.toLowerCase().trim();
    let matched = false;
    for (const [key, category] of Object.entries(keywords)) {
      if (lower === key || lower.includes(key)) {
        categories[category].push(skill);
        matched = true;
        break;
      }
    }
    if (!matched) {
      others.push(skill);
    }
  });

  if (others.length > 0) {
    categories["Other Skills"] = others;
  }

  return Object.fromEntries(
    Object.entries(categories).filter(([_, list]) => list.length > 0)
  );
};

export const CVPreview: React.FC<CVPreviewProps> = ({
  basic,
  summary,
  skills,
  experience,
  education,
  achievements,
  preferences,
  projects = [],
}) => {
  // Clean and split lines of text into bullets
  const renderBulletPoints = (text: string) => {
    if (!text) return null;
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return null;

    return (
      <ul className="list-disc pl-4 space-y-0.5 text-neutral-700 mt-1 text-[11px]">
        {lines.map((line, idx) => {
          const cleanLine = line.replace(/^[•\*\-\u25e6]\s*/, "");
          return (
            <li key={idx} className="leading-relaxed" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {cleanLine}
            </li>
          );
        })}
      </ul>
    );
  };

  // Helper to render verification badge
  const renderVerificationBadge = (level: any, status: any) => {
    const numLevel = typeof level === 'string'
      ? (level === 'AiAnalyzed' ? 1 : level === 'RepositoryLinked' ? 2 : 3)
      : level;
    const numStatus = typeof status === 'string'
      ? (status === 'Verified' ? 1 : status === 'Outdated' ? 2 : status === 'Disconnected' ? 3 : 4)
      : status;

    if (numLevel === 1) { // AI Analyzed
      if (status === 2) {
        return (
          <span className="text-[8px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block w-max select-none uppercase tracking-wide">
            AI Audited • Outdated
          </span>
        );
      }
      if (status === 3) {
        return (
          <span className="text-[8px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 mt-0.5 inline-block w-max select-none uppercase tracking-wide">
            AI Audited • Disconnected
          </span>
        );
      }
      return (
        <span className="text-[8px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5 inline-block w-max select-none uppercase tracking-wide">
          AI Audited
        </span>
      );
    }
    if (level === 2) { // Repo Linked
      if (status === 3) {
        return (
          <span className="text-[8px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 mt-0.5 inline-block w-max select-none uppercase tracking-wide">
            Repo Linked • Disconnected
          </span>
        );
      }
      return (
        <span className="text-[8px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-0.5 inline-block w-max select-none uppercase tracking-wide">
          Repo Linked
        </span>
      );
    }
    // Independent
    return (
      <span className="text-[8px] font-extrabold text-neutral-600 bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-200 mt-0.5 inline-block w-max select-none uppercase tracking-wide">
        Self Declared
      </span>
    );
  };

  // Normalize project inputs (real repos vs sample data)
  const normalizedProjects = projects.map((p: any) => {
    // If it's a new unified project portfolio item:
    if (p.verificationLevel !== undefined) {
      const start = formatMonthYear(p.startDate);
      const end = p.isCurrentlyWorking ? "Present" : formatMonthYear(p.endDate);
      const numLevel = typeof p.verificationLevel === 'string'
        ? (p.verificationLevel === 'AiAnalyzed' ? 1 : p.verificationLevel === 'RepositoryLinked' ? 2 : 3)
        : p.verificationLevel;
      const numStatus = typeof p.verificationStatus === 'string'
        ? (p.verificationStatus === 'Verified' ? 1 : p.verificationStatus === 'Outdated' ? 2 : p.verificationStatus === 'Disconnected' ? 3 : 4)
        : p.verificationStatus;
      return {
        id: p.id || p.name,
        name: p.name,
        dateRange: start && end ? `${start} - ${end}` : (start || end || "N/A"),
        description: p.description || "",
        technologies: p.technologies || [],
        role: p.role || "",
        contributions: p.contributions || [],
        verificationLevel: numLevel,
        verificationStatus: numStatus,
      };
    }

    // Fallback for old/legacy model or sample data:
    const isRealRepo = p.createdAtUtc !== undefined;
    if (isRealRepo) {
      const start = formatMonthYear(p.createdAtUtc);
      const end = p.lastCommitAt ? formatMonthYear(p.lastCommitAt) : "Present";
      const techList = p.primaryLanguage ? [p.primaryLanguage] : (p.cvSynthesis?.skills || []);
      const highlightsList = p.cvSynthesis?.highlights?.map((h: any) => h.impact ? `${h.signal}: ${h.impact}` : h.signal) || [];

      return {
        id: p.id,
        name: p.name,
        dateRange: `${start} - ${end}`,
        description: p.description || "",
        technologies: techList,
        role: p.cvSynthesis?.ownershipProfile || "Contributor",
        contributions: highlightsList,
        verificationLevel: 1, // AI Analyzed
        verificationStatus: 1, // Verified
      };
    } else {
      const start = formatMonthYear(p.startDate);
      const end = p.endDate ? formatMonthYear(p.endDate) : "Present";
      return {
        id: p.id || p.name,
        name: p.name,
        dateRange: `${start} - ${end}`,
        description: p.description || "",
        technologies: p.technologies || [],
        role: p.role || "Developer",
        contributions: p.contributions || [],
        verificationLevel: 3, // Independent
        verificationStatus: 4, // Unverified
      };
    }
  });

  // Categorize skills
  const categorizedSkills = skills.targetSkills ? categorizeSkills(skills.targetSkills) : {};
  const hasSkills = skills.targetSkills && skills.targetSkills.length > 0;

  // Render social icon
  const renderSocialIcon = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes("github.com")) return <GitHubIcon className="size-3 text-neutral-600 shrink-0" />;
    if (lower.includes("linkedin.com")) return <LinkedInIcon className="size-3 text-neutral-600 shrink-0" />;
    return <Link2 className="size-3 text-neutral-600 shrink-0" />;
  };

  return (
    <div className="cv-print-area w-[210mm] min-h-[297mm] bg-white text-black p-[20mm] box-border relative flex flex-col justify-between font-sans text-xs shadow-md border border-border print:shadow-none print:border-none select-text">
      <style>{`
        @page {
          size: A4;
          /* Zero page margin so the browser does NOT inject its own date/URL/page
             headers & footers into the margin area. The 20mm CV inset is instead
             applied via padding on .cv-print-area below, so the printed sheet looks
             exactly like the clean on-screen CV preview. */
          margin: 0;
        }
        @media print {
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

          /* Hide all screen UI; the CV area overrides this below */
          body * {
            visibility: hidden !important;
          }

          .cv-print-area,
          .cv-print-area * {
            visibility: visible !important;
          }

          /* With @page margin set to 0 (to suppress browser headers/footers), the
             20mm inset is applied here as padding so every printed page keeps the
             same uniform border as the on-screen preview. */
          .cv-print-area {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 20mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            box-sizing: border-box !important;
            display: block !important;
            z-index: auto !important;
          }

          /* Reset viewport-locked containers so multi-page flow works */
          .min-h-screen,
          .h-screen,
          .overflow-hidden,
          .overflow-y-auto,
          main,
          #__next,
          #root {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          /* Flatten modal / overlay wrappers */
          .cv-preview-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: 99999 !important;
            backdrop-filter: none !important;
            height: auto !important;
            min-height: auto !important;
          }
          .cv-preview-card {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .cv-preview-content-frame {
            display: block !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
          }
          .cv-preview-scale-wrapper {
            width: 100% !important;
            height: auto !important;
            position: static !important;
            flex-shrink: unset !important;
          }
          .cv-preview-box {
            display: block !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            transform: none !important;
            position: static !important;
            width: 100% !important;
          }

          /* Remove non-CV chrome */
          header,
          footer,
          nav,
          aside,
          button,
          .cv-management-header,
          .cv-management-main,
          .no-print {
            display: none !important;
          }

          /* Print footer: in-flow at the end of CV content */
          .cv-footer-print {
            display: flex !important;
            position: static !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-top: 0.5px solid #d1d5db !important;
            padding-top: 2mm !important;
            margin-top: 6mm !important;
            font-size: 7pt !important;
            color: #9ca3af !important;
            background: white !important;
            visibility: visible !important;
          }

          .cv-footer-print .page-num-print::after {
            counter-increment: page;
            content: "Page " counter(page);
          }

          .cv-page-content-wrapper {
            margin-bottom: 0 !important;
          }

          /* Screen-only footer is not needed in print */
          .cv-footer-screen {
            display: none !important;
          }
        }

        .cv-footer-print {
          display: none;
        }
        .cv-item-avoid-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `}</style>

      {/* Main Flow Content Container */}
      <div className="cv-page-content-wrapper flex flex-col gap-5 flex-1">
        
        {/* Centered Header */}
        <div className="flex flex-col items-center text-center gap-1.5 pb-4 w-full min-w-0">
          <h1 
            className="text-xl font-bold tracking-tight text-neutral-900 uppercase w-full"
            style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
          >
            {basic.fullName || "Untitled"}
          </h1>
          {basic.headline && (
            <span 
              className="text-[11px] font-bold text-neutral-600 tracking-wider uppercase w-full"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {basic.headline}
            </span>
          )}

          {/* Contact Details Grid */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-1 text-[10.5px] text-neutral-700 max-w-[95%] min-w-0">
            {basic.phoneNumber && (
              <span className="flex items-center gap-1 min-w-0" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <Phone className="size-3 text-neutral-600 shrink-0" />
                {basic.phoneNumber}
              </span>
            )}
            {basic.publicEmail && (
              <span className="flex items-center gap-1 min-w-0" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <Mail className="size-3 text-neutral-600 shrink-0" />
                {basic.publicEmail}
              </span>
            )}
            {basic.birthDate && (
              <span className="flex items-center gap-1 min-w-0" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <Calendar className="size-3 text-neutral-600 shrink-0" />
                {formatMonthYear(basic.birthDate)}
              </span>
            )}
            {basic.location && (
              <span className="flex items-center gap-1 min-w-0" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <MapPin className="size-3 text-neutral-600 shrink-0" />
                {basic.location}
              </span>
            )}
            {basic.socialLinks && basic.socialLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.startsWith("http") ? link : `https://${link}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:underline text-neutral-700 min-w-0"
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {renderSocialIcon(link)}
                {formatSocialLink(link)}
              </a>
            ))}
          </div>
        </div>

        {/* Section: About Me */}
        {summary.bio && (
          <div className="flex flex-col gap-1 text-left cv-item-avoid-break">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
              Career Objective / Summary
            </h2>
            <div className="border-b border-neutral-300 w-full my-0.5" />
            <p className="text-neutral-700 leading-relaxed font-normal text-[11px] whitespace-pre-wrap">
              {summary.bio}
            </p>
          </div>
        )}

        {/* Section: Work Experience */}
        {experience && experience.length > 0 && (
          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
              Work Experience
            </h2>
            <div className="border-b border-neutral-300 w-full my-0.5" />
            <div className="flex flex-col gap-3 mt-1">
              {experience.map((exp) => {
                const start = formatMonthYear(exp.startDate);
                const end = exp.isCurrentlyWorking ? "Present" : formatMonthYear(exp.endDate);

                return (
                  <div key={exp.id} className="flex flex-col gap-0.5 cv-item-avoid-break">
                    <div className="flex items-start justify-between font-bold text-neutral-900 text-[11px]">
                      <span>{exp.jobTitle}</span>
                      <span className="text-[10px] text-neutral-600 font-normal shrink-0 pl-4">
                        {start} to {end}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-neutral-700 font-medium italic">
                      {exp.company}{exp.location ? ` • ${exp.location}` : ""}
                    </div>
                    {renderBulletPoints(exp.description)}
                    
                    {exp.achievements && exp.achievements.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5 text-neutral-700 mt-0.5 text-[11px]">
                        {exp.achievements.map((ach: any, idx: number) => (
                          <li key={idx} className="leading-relaxed">
                            <span className="font-bold">{ach.title}:</span> {ach.description}
                          </li>
                        ))}
                      </ul>
                    )}

                    {exp.technologies && exp.technologies.length > 0 && (
                      <div className="text-[10px] text-neutral-600 mt-1 pl-4">
                        <span className="font-bold">Technologies:</span>{" "}
                        {exp.technologies.join(", ")}
                      </div>
                    )}
                    
                    {exp.links && exp.links.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1 pl-4">
                        {exp.links.map((link: any, idx: number) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-600 hover:underline flex items-center gap-0.5 text-[10px]"
                          >
                            <Link2 className="size-2.5" />
                            {formatSocialLink(link.url)}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Education */}
        {education && education.length > 0 && (
          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
              Education & Credentials
            </h2>
            <div className="border-b border-neutral-300 w-full my-0.5" />
            <div className="flex flex-col gap-3 mt-1">
              {education.map((edu) => {
                const schoolName = edu.schoolName || edu.school || "";
                const startDate = edu.startDate || edu.period?.start?.toString() || "";
                const endDate = edu.endDate || edu.period?.end?.toString() || "";
                const start = formatMonthYear(startDate);
                const end = edu.isCurrentlyStudying ? "Present" : formatMonthYear(endDate);

                return (
                  <div key={edu.id} className="flex flex-col gap-0.5 cv-item-avoid-break">
                    <div className="flex items-start justify-between font-bold text-neutral-900 text-[11px]">
                      <span>{schoolName}{edu.label ? ` - ${edu.label}` : ""}</span>
                      <span className="text-[10px] text-neutral-600 font-normal shrink-0 pl-4">
                        {start && end ? `${start} to ${end}` : (start || end || "")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-700 text-[10.5px]">
                      <span>
                        {edu.degree || ""}{edu.major ? `${edu.degree ? " - " : ""}${edu.major}` : ""}
                      </span>
                      {edu.gpa && (
                        <span className="font-bold shrink-0 pl-4">
                          GPA: {edu.gpa}/{edu.gpaScale || 4.0}
                        </span>
                      )}
                    </div>
                    {renderBulletPoints(edu.description)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Projects */}
        {normalizedProjects.length > 0 && (
          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
              Linked Projects
            </h2>
            <div className="border-b border-neutral-300 w-full my-0.5" />
            <div className="flex flex-col gap-3 mt-1">
              {normalizedProjects.map((proj) => (
                <div key={proj.id} className="flex flex-col gap-0.5 cv-item-avoid-break">
                  <div className="flex items-start justify-between font-bold text-neutral-900 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{proj.name}</span>
                      {renderVerificationBadge(proj.verificationLevel, proj.verificationStatus)}
                    </div>
                    <span className="text-[10px] text-neutral-600 font-normal shrink-0 pl-4">
                      {proj.dateRange}
                    </span>
                  </div>
                  {proj.description && (
                    <p className="text-neutral-700 italic text-[11px] leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                  
                  <ul className="list-disc pl-4 space-y-0.5 text-neutral-700 mt-0.5 text-[11px]">
                    {proj.role && (
                      <li className="leading-relaxed">
                        <span className="font-bold">Role:</span> {proj.role}
                      </li>
                    )}
                    {proj.technologies && proj.technologies.length > 0 && (
                      <li className="leading-relaxed">
                        <span className="font-bold">Technologies:</span> {proj.technologies.join(", ")}
                      </li>
                    )}
                    {proj.contributions && proj.contributions.length > 0 && (
                      <li className="list-none mt-0.5">
                        <span className="font-bold text-[11px]">Key Contributions:</span>
                        <ul className="list-circle pl-4 space-y-0.5 text-neutral-700 mt-0.5 text-[10.5px]">
                          {proj.contributions.map((con: string, cIdx: number) => (
                            <li key={cIdx} className="leading-relaxed">
                              {con}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Technical Skills */}
        {hasSkills && (
          <div className="flex flex-col gap-1 text-left cv-item-avoid-break">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
              Technical Skills
            </h2>
            <div className="border-b border-neutral-300 w-full my-0.5" />
            
            <div className="flex flex-col gap-1 mt-1 text-[11px] text-neutral-800">
              {Object.keys(categorizedSkills).length > 0 ? (
                Object.entries(categorizedSkills).map(([category, items]) => (
                  <div key={category} className="leading-relaxed" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                    <span className="font-bold">{category}:</span> {items.join(", ")}
                  </div>
                ))
              ) : (
                <div className="leading-relaxed" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                  {skills.targetSkills?.join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: Achievements & Certificates */}
        {achievements && achievements.length > 0 && (
          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
              Achievements & Certificates
            </h2>
            <div className="border-b border-neutral-300 w-full my-0.5" />
            <div className="flex flex-col gap-3 mt-1">
              {achievements.map((ach) => (
                <div key={ach.id} className="flex flex-col gap-0.5 cv-item-avoid-break">
                  <div className="flex items-start justify-between font-bold text-neutral-900 text-[11px]">
                    <span>{ach.title}</span>
                    <span className="text-[10px] text-neutral-600 font-normal shrink-0 pl-4">
                      {formatMonthYear(ach.issueDate)}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-neutral-700 font-medium">
                    Issued by: {ach.issuer}
                  </div>
                  {renderBulletPoints(ach.description)}
                  {ach.credentialUrl && (
                    <a
                      href={ach.credentialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-600 hover:underline flex items-center gap-0.5 text-[10px] mt-0.5 min-w-0"
                      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                    >
                      <Link2 className="size-2.5" />
                      {formatSocialLink(ach.credentialUrl)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Career Preferences */}
        <div className="flex flex-col gap-1 text-left cv-item-avoid-break">
          <h2 className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">
            Career Preferences
          </h2>
          <div className="border-b border-neutral-300 w-full my-0.5" />
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1 text-[10.5px] text-neutral-700">
            {preferences.openToWorkStatus && (
              <div>
                <span className="font-bold text-neutral-900">Job Search Status:</span>{" "}
                <span>
                  {preferences.openToWorkStatus === "active"
                    ? "Active Job Search"
                    : preferences.openToWorkStatus === "casual"
                    ? "Casual Browsing"
                    : "Not Open to Work"}
                </span>
              </div>
            )}
            {preferences.desiredJobPositions && preferences.desiredJobPositions.length > 0 && (
              <div>
                <span className="font-bold text-neutral-900">Target Roles:</span>{" "}
                <span>{preferences.desiredJobPositions.join(", ")}</span>
              </div>
            )}
            {(preferences.expectedSalaryMin || preferences.expectedSalaryMax) && (
              <div>
                <span className="font-bold text-neutral-900">Expected Salary:</span>{" "}
                <span>
                  {preferences.expectedSalaryNegotiable
                    ? "Negotiable"
                    : `${preferences.expectedSalaryMin?.toLocaleString() || "0"} - ${preferences.expectedSalaryMax?.toLocaleString() || "Any"} ${preferences.expectedSalaryCurrency || "USD"} (${preferences.expectedSalaryType || "Monthly"})`}
                </span>
              </div>
            )}
            {preferences.remotePreference && (
              <div>
                <span className="font-bold text-neutral-900">Work Arrangement:</span>{" "}
                <span className="capitalize">{preferences.remotePreference}</span>
              </div>
            )}
            {preferences.preferredLocations && preferences.preferredLocations.length > 0 && (
              <div>
                <span className="font-bold text-neutral-900">Desired Locations:</span>{" "}
                <span>{preferences.preferredLocations.join(", ")}</span>
              </div>
            )}
            {preferences.employmentPreferences && preferences.employmentPreferences.length > 0 && (
              <div>
                <span className="font-bold text-neutral-900">Employment Types:</span>{" "}
                <span className="capitalize">{preferences.employmentPreferences.join(", ")}</span>
              </div>
            )}
            {preferences.workPreferenceNotes && (
              <div className="col-span-2 mt-0.5">
                <span className="font-bold text-neutral-900">Additional Work Preference Notes:</span>{" "}
                <span className="italic">{preferences.workPreferenceNotes}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Subtle Authentication Footer (Visible on screen and repeated on each print page via fixed css) */}
      <div className="cv-footer-print mt-6 border-t border-neutral-300 pt-2 flex justify-between items-center text-[8.5px] text-neutral-500 font-sans select-none">
        <span>Verified by CVerify • AI-assisted candidate profile authentication</span>
        <span className="page-num-print" />
      </div>

      <div className="cv-footer-screen mt-6 border-t border-neutral-300 pt-2 flex justify-between items-center text-[8.5px] text-neutral-500 font-sans select-none print:hidden">
        <span>Verified by CVerify • AI-assisted candidate profile authentication</span>
        <span>Page 1/1</span>
      </div>
    </div>
  );
};
