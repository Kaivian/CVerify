import React from "react";
import { type CvTemplate, type TemplateBlockProps } from "./types";
import { Phone, Mail, MapPin, Link2 } from "lucide-react";
import { Separator } from "@heroui/react";

// ---------------------------------------------------------
// Modern Overrides
// ---------------------------------------------------------

const ModernHeader: React.FC<{ data: any; avatarUrl?: string | null }> = ({ data, avatarUrl }) => {
  return (
    <div className="flex flex-col w-full select-text text-left gap-4">
      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col text-left">
          {data.headline && (
            <span className="text-[9.5px] font-extrabold tracking-[0.18em] text-neutral-500 uppercase">
              {data.headline}
            </span>
          )}
          <h1 className="text-[28px] font-normal font-serif tracking-wider text-neutral-900 mt-2 uppercase leading-none">
            {data.fullName || "Untitled"}
          </h1>
        </div>

        {/* Circular Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-18 h-18 rounded-full object-cover border border-neutral-200 shrink-0 shadow-xs"
          />
        ) : (
          <div className="w-18 h-18 rounded-full bg-neutral-100 border border-neutral-200 shrink-0 flex items-center justify-center text-neutral-400 font-bold text-lg uppercase font-serif shadow-xs">
            {data.fullName?.substring(0, 2) || "CV"}
          </div>
        )}
      </div>
      <Separator className="bg-neutral-300" />
    </div>
  );
};

const ModernContact: React.FC<{ data: any }> = ({ data }) => {
  const formatSocialLink = (url: string): string => {
    if (!url) return "";
    return url.replace(/^(https?:\/\/)?(www\.)?/, "");
  };

  return (
    <div className="flex flex-col text-left gap-2.5 w-full pr-2 mt-2 pb-2 select-text">
      <h3 className="font-extrabold text-[10px] uppercase tracking-[0.18em] text-neutral-800 leading-none">
        CONTACT
      </h3>
      <div className="flex flex-col gap-2 mt-1.5 text-[9.5px] text-neutral-700">
        {data.location && (
          <span className="flex items-start gap-2 leading-tight">
            <MapPin className="size-3.5 text-neutral-500 shrink-0 mt-0.5" />
            <span>{data.location}</span>
          </span>
        )}
        {data.phoneNumber && (
          <span className="flex items-center gap-2 leading-tight">
            <Phone className="size-3.5 text-neutral-500 shrink-0" />
            <span>{data.phoneNumber}</span>
          </span>
        )}
        {data.publicEmail && (
          <span className="flex items-center gap-2 leading-tight">
            <Mail className="size-3.5 text-neutral-500 shrink-0" />
            <span className="truncate">{data.publicEmail}</span>
          </span>
        )}
        {data.socialLinks && data.socialLinks.map((link: string, idx: number) => (
          <a
            key={idx}
            href={link.startsWith("http") ? link : `https://${link}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:underline text-neutral-700 leading-tight"
          >
            <Link2 className="size-3.5 text-neutral-500 shrink-0" />
            <span className="truncate">{formatSocialLink(link)}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

const ModernParagraph: React.FC<{ data: any }> = ({ data }) => {
  return (
    <p className={`text-neutral-700 leading-relaxed font-normal text-[9.5px] whitespace-pre-wrap text-left -mt-1.5 ${data.isItalic ? "italic text-neutral-500" : ""}`}>
      {data.text}
    </p>
  );
};

const ModernSectionTitle: React.FC<{ data: any }> = ({ data }) => {
  const isSummary = data.title.toLowerCase().includes("summary") || data.title.toLowerCase().includes("objective");
  return (
    <div className="w-full mt-1 pb-1 select-none text-left">
      {!isSummary && <Separator className="bg-neutral-200 mb-2" />}
      <h2 className="font-extrabold text-[10px] uppercase tracking-[0.18em] text-neutral-800 leading-none">
        {data.title}
      </h2>
    </div>
  );
};

const ModernTechList: React.FC<{ data: any }> = ({ data }) => {
  const skills = data.flatSkills || [];
  return (
    <div className="flex flex-col text-left gap-1.5 mt-1 pb-1 w-full pr-2">
      {skills.map((skill: string, idx: number) => (
        <div key={idx} className="flex items-start gap-2 text-[9.5px] text-neutral-700 leading-tight">
          <span className="text-[6px] text-neutral-400 select-none pt-1">■</span>
          <span className="flex-1">{skill}</span>
        </div>
      ))}
    </div>
  );
};

const ModernEntryHeader: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="flex flex-col gap-0.5 w-full mt-2 select-text">
      <h4 className="font-bold text-neutral-800 text-[10px] uppercase tracking-wide text-left leading-none">
        {data.title}
      </h4>
      <div className="text-neutral-500 text-[9px] text-left font-semibold mt-1 select-none">
        <span>{data.subtitle}</span>
        {data.dateRange && <span className="text-neutral-400"> . | {data.dateRange}</span>}
      </div>
    </div>
  );
};

const ModernBulletPoint: React.FC<{ data: any }> = ({ data }) => {
  if (data.isSubheading) {
    return (
      <div className="text-[9px] font-bold text-neutral-800 uppercase tracking-wide text-left mt-1 pl-1">
        {data.text}
      </div>
    );
  }

  if (data.isLink) {
    return (
      <div className="flex items-center gap-1 text-[9px] pl-1 text-left">
        <a href={data.url} target="_blank" rel="noreferrer" className="text-neutral-600 hover:underline flex items-center gap-0.5">
          <Link2 className="size-2.5" />
          {data.text}
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 pl-1 text-left text-[9.5px] text-neutral-500 leading-relaxed min-w-0">
      <span className="text-[8px] text-neutral-300 select-none pt-0.5">•</span>
      <div className="flex-1 min-w-0">
        {data.prefix && <span className="font-semibold text-neutral-800">{data.prefix}: </span>}
        {data.text}
      </div>
    </div>
  );
};

const ModernPreferencesGrid: React.FC<{ data: any }> = ({ data }) => {
  const pref = data.preferences;

  return (
    <div className="flex flex-col gap-1.5 mt-1 text-[9.5px] text-neutral-700 text-left w-full pr-2">
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
      {pref.preferredLanguage && (
        <div>
          <span className="font-bold text-neutral-900">Spoken Language:</span>{" "}
          <span>
            {pref.preferredLanguage === "en" ? "English" :
             pref.preferredLanguage === "vi" ? "Vietnamese" :
             pref.preferredLanguage === "ja" ? "Japanese" :
             pref.preferredLanguage === "ko" ? "Korean" :
             pref.preferredLanguage === "zh" ? "Chinese" : pref.preferredLanguage}
          </span>
        </div>
      )}
      {pref.leadershipTrack && pref.leadershipTrack !== "undecided" && (
        <div>
          <span className="font-bold text-neutral-900">Leadership Track:</span>{" "}
          <span>
            {pref.leadershipTrack === "management" ? "Engineering Management" : "Individual Contributor"}
          </span>
        </div>
      )}
      {pref.workPreferenceNotes && (
        <div className="mt-0.5">
          <span className="font-bold text-neutral-900">Work Preference Notes:</span>{" "}
          <span className="italic">{pref.workPreferenceNotes}</span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// Minimal Overrides
// ---------------------------------------------------------

const MinimalHeader: React.FC<{ data: any }> = ({ data }) => {
  const formatSocialLink = (url: string): string => {
    if (!url) return "";
    return url.replace(/^(https?:\/\/)?(www\.)?/, "");
  };

  return (
    <div className="flex flex-col text-left gap-1 pb-2 w-full min-w-0">
      <h1 className="text-xl font-light tracking-[0.12em] text-neutral-900 uppercase w-full">
        {data.fullName || "Untitled"}
      </h1>
      {data.headline && (
        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">
          {data.headline}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[9.5px] text-neutral-500 uppercase tracking-wider">
        {data.phoneNumber && <span>{data.phoneNumber}</span>}
        {data.publicEmail && <span>{data.publicEmail}</span>}
        {data.location && <span>{data.location}</span>}
        {data.socialLinks && data.socialLinks.map((link: string, idx: number) => (
          <span key={idx}>{formatSocialLink(link)}</span>
        ))}
      </div>
      <Separator className="bg-neutral-100 mt-2" />
    </div>
  );
};

const MinimalSectionTitle: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="flex items-center gap-1 text-left w-full mt-4">
      <h2 className="font-bold text-[10px] uppercase tracking-[0.18em] text-neutral-800">
        {data.title}
      </h2>
    </div>
  );
};

const MinimalEntryHeader: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="flex flex-col gap-0.5 w-full mt-1.5">
      <div className="flex items-start justify-between text-neutral-900 text-[10.5px] text-left">
        <span className="font-semibold">{data.title}</span>
        <span className="text-[9.5px] text-neutral-400 font-medium shrink-0 pl-4 select-none">
          {data.dateRange}
        </span>
      </div>
      {(data.subtitle || data.rightSubtitle) && (
        <div className="flex items-center justify-between text-neutral-500 text-[9.5px]">
          <span>{data.subtitle}</span>
          {data.rightSubtitle && <span className="font-medium text-neutral-600 pl-4">{data.rightSubtitle}</span>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// Executive Overrides
// ---------------------------------------------------------

const removeAccents = (val: any): string => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

const ExecutiveRow: React.FC<{
  left?: React.ReactNode;
  right: React.ReactNode;
}> = ({ left, right }) => {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-6 w-full text-left font-serif select-text">
      <div className="text-[9.5px] font-bold text-neutral-800 uppercase tracking-widest leading-normal shrink-0">
        {left || ""}
      </div>
      <div className="text-[10px] text-neutral-800 leading-normal min-w-0">
        {right}
      </div>
    </div>
  );
};

const ExecutiveHeader: React.FC<TemplateBlockProps> = ({ data }) => {
  return (
    <div className="flex flex-col items-center text-center gap-1 w-full font-serif select-text">
      <h1 className="text-xl font-bold tracking-wide text-neutral-950 font-serif">
        {removeAccents(data.fullName) || "Untitled"}
        {data.headline && <span className="font-normal text-neutral-700">, {removeAccents(data.headline)}</span>}
      </h1>
    </div>
  );
};

const ExecutiveContact: React.FC<TemplateBlockProps> = ({ data }) => {
  const formatSocialLink = (url: string): string => {
    if (!url) return "";
    return url.replace(/^(https?:\/\/)?(www\.)?/, "");
  };

  const contactLine1: string[] = [];
  if (data.location) contactLine1.push(removeAccents(data.location));

  const contactLine2: string[] = [];
  if (data.phoneNumber) contactLine2.push(removeAccents(data.phoneNumber));
  if (data.publicEmail) contactLine2.push(removeAccents(data.publicEmail));
  if (data.socialLinks && data.socialLinks.length > 0) {
    data.socialLinks.forEach((link: string) => {
      contactLine2.push(removeAccents(formatSocialLink(link)));
    });
  }

  return (
    <div className="flex flex-col items-center text-center w-full font-serif select-text -mt-2.5">
      {contactLine1.length > 0 && (
        <div className="text-[9.5px] text-neutral-600 tracking-wide">
          {contactLine1.join("  •  ")}
        </div>
      )}
      {contactLine2.length > 0 && (
        <div className="text-[9.5px] text-neutral-600 tracking-wide mt-0.5">
          {contactLine2.join("  —  ")}
        </div>
      )}
    </div>
  );
};

const ExecutiveSectionTitle: React.FC<TemplateBlockProps> = ({ data, blockId }) => {
  const isSummary = blockId === "section-title-summary";
  
  if (isSummary) {
    return (
      <div className="w-full mt-3 select-none">
        <Separator className="bg-neutral-300 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full mt-3 select-none flex flex-col gap-2.5">
      <Separator className="bg-neutral-300 w-full" />
      <ExecutiveRow
        left={<span className="text-[10px] font-bold text-neutral-900 tracking-widest">{removeAccents(data.title)}</span>}
        right={null}
      />
    </div>
  );
};

const ExecutiveEntryHeader: React.FC<TemplateBlockProps> = ({ data }) => {
  let company = data.subtitle || "";
  let location = "";
  if (company.includes(" • ")) {
    const parts = company.split(" • ");
    company = parts[0];
    location = parts[1];
  }
  const rightInfo = data.rightSubtitle || location;

  const renderVerificationBadge = (level: number, status: number) => {
    if (level === 1) { // AI Analyzed
      if (status === 2) {
        return (
          <span className="cv-badge text-[7.5px] font-extrabold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 select-none uppercase tracking-wide font-sans ml-1.5">
            AI • Outdated
          </span>
        );
      }
      if (status === 3) {
        return (
          <span className="cv-badge text-[7.5px] font-extrabold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 select-none uppercase tracking-wide font-sans ml-1.5">
            AI • Disconnected
          </span>
        );
      }
      return (
        <span className="cv-badge text-[7.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/50 select-none uppercase tracking-wide font-sans ml-1.5">
          AI Verified
        </span>
      );
    }
    if (level === 2) { // Repo Linked
      if (status === 3) {
        return (
          <span className="cv-badge text-[7.5px] font-extrabold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 select-none uppercase tracking-wide font-sans ml-1.5">
            Repo • Disconnected
          </span>
        );
      }
      return (
        <span className="cv-badge text-[7.5px] font-extrabold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200/50 select-none uppercase tracking-wide font-sans ml-1.5">
          Repo Linked
        </span>
      );
    }
    return (
      <span className="cv-badge text-[7.5px] font-extrabold text-neutral-600 bg-neutral-50 px-1 py-0.5 rounded border border-neutral-200/50 select-none uppercase tracking-wide font-sans ml-1.5">
        Self Declared
      </span>
    );
  };

  return (
    <ExecutiveRow
      left={
        <span className="text-[10px] text-neutral-600 font-sans tracking-tight font-normal whitespace-nowrap">
          {removeAccents(data.dateRange)}
        </span>
      }
      right={
        <div className="flex flex-col gap-0.5 w-full">
          <div className="flex justify-between items-baseline w-full">
            <span className="font-bold text-neutral-900 text-[10.5px] inline-flex items-center flex-wrap">
              {removeAccents(data.title)}
              {company && <span className="font-normal text-neutral-600">, {removeAccents(company)}</span>}
              {data.verificationLevel !== undefined &&
                renderVerificationBadge(data.verificationLevel, data.verificationStatus)}
            </span>
            {rightInfo && (
              <span className="text-[9.5px] text-neutral-500 font-medium font-sans shrink-0 pl-4">
                {removeAccents(rightInfo)}
              </span>
            )}
          </div>
        </div>
      }
    />
  );
};

const ExecutiveParagraph: React.FC<TemplateBlockProps> = ({ data, blockId }) => {
  const isFirstSummaryPara = blockId === "summary-paragraph-0";
  return (
    <ExecutiveRow
      left={
        isFirstSummaryPara ? (
          <span className="text-[10px] font-bold text-neutral-900 tracking-widest">
            CAREER OBJECTIVE / SUMMARY
          </span>
        ) : null
      }
      right={
        <p className={`text-neutral-700 leading-relaxed text-[9.5px] whitespace-pre-wrap ${data.isItalic ? "italic text-neutral-500" : ""}`}>
          {removeAccents(data.text)}
        </p>
      }
    />
  );
};

const ExecutiveBulletPoint: React.FC<TemplateBlockProps> = ({ data }) => {
  if (data.isSubheading) {
    return (
      <ExecutiveRow
        left={null}
        right={
          <div className="text-[9.5px] font-bold text-neutral-800 uppercase tracking-wide mt-1">
            {removeAccents(data.text)}
          </div>
        }
      />
    );
  }

  if (data.isLink) {
    return (
      <ExecutiveRow
        left={null}
        right={
          <div className="flex items-center gap-1 text-[9px] text-neutral-600 hover:underline">
            <a href={data.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5">
              <Link2 className="size-2.5 text-neutral-500 shrink-0" />
              {removeAccents(data.text)}
            </a>
          </div>
        }
      />
    );
  }

  return (
    <ExecutiveRow
      left={null}
      right={
        <div className="flex items-start gap-2 text-[9.5px] text-neutral-700 leading-relaxed min-w-0">
          <span className="text-[10px] text-neutral-400 select-none pt-0.5">•</span>
          <div className="flex-1 min-w-0">
            {data.prefix && <span className="font-semibold text-neutral-900">{removeAccents(data.prefix)}: </span>}
            {removeAccents(data.text)}
          </div>
        </div>
      }
    />
  );
};

const ExecutiveTechList: React.FC<TemplateBlockProps> = ({ data, blockId }) => {
  const isGlobalSkills = blockId === "skills-content";
  
  if (isGlobalSkills) {
    return (
      <ExecutiveRow
        left={
          <span className="text-[8.5px] text-neutral-500 normal-case tracking-normal font-sans font-normal italic">
            Skills inventory
          </span>
        }
        right={
          <div className="flex flex-col gap-1.5 w-full">
            {data.categorizedSkills && Object.keys(data.categorizedSkills).length > 0 ? (
              Object.entries(data.categorizedSkills as Record<string, string[]>).map(([category, items]) => (
                <div key={category} className="text-[9.5px]">
                  <span className="font-bold text-neutral-900">{removeAccents(category)}:</span>{" "}
                  <span className="text-neutral-700">{items.map(i => removeAccents(i)).join(", ")}</span>
                </div>
              ))
            ) : (
              <div className="text-[9.5px] text-neutral-700 leading-relaxed">
                {data.flatSkills?.map((i: any) => removeAccents(i)).join(", ")}
              </div>
            )}
          </div>
        }
      />
    );
  }

  return (
    <ExecutiveRow
      left={null}
      right={
        <div className="text-[9.5px] text-neutral-600 mt-0.5">
          <span className="font-bold text-neutral-800">{removeAccents(data.label || "Technologies")}:</span>{" "}
          {data.items?.map((i: any) => removeAccents(i)).join(", ")}
        </div>
      }
    />
  );
};

const ExecutivePreferencesGrid: React.FC<TemplateBlockProps> = ({ data }) => {
  const pref = data.preferences;
  
  return (
    <ExecutiveRow
      left={
        <span className="text-[8.5px] text-neutral-500 normal-case tracking-normal font-sans font-normal italic">
          Target preferences
        </span>
      }
      right={
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 w-full text-[9.5px] text-neutral-700 mt-0.5">
          {pref.openToWorkStatus && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Job Search Status:</span>{" "}
              <span className="font-serif">
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
              <span className="font-bold text-neutral-900 font-serif">Target Roles:</span>{" "}
              <span className="font-serif">{pref.desiredJobPositions.map((i: any) => removeAccents(i)).join(", ")}</span>
            </div>
          )}
          {(pref.expectedSalaryMin || pref.expectedSalaryMax) && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Expected Salary:</span>{" "}
              <span className="font-serif">
                {pref.expectedSalaryNegotiable
                  ? "Negotiable"
                  : `${pref.expectedSalaryMin?.toLocaleString() || "0"} - ${pref.expectedSalaryMax?.toLocaleString() || "Any"} ${removeAccents(pref.expectedSalaryCurrency || "USD")}`}
              </span>
            </div>
          )}
          {pref.remotePreference && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Work Arrangement:</span>{" "}
              <span className="capitalize font-serif">{removeAccents(pref.remotePreference)}</span>
            </div>
          )}
          {pref.preferredLocations && pref.preferredLocations.length > 0 && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Desired Locations:</span>{" "}
              <span className="font-serif">{pref.preferredLocations.map((i: any) => removeAccents(i)).join(", ")}</span>
            </div>
          )}
          {pref.employmentPreferences && pref.employmentPreferences.length > 0 && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Employment Types:</span>{" "}
              <span className="capitalize font-serif">{pref.employmentPreferences.map((i: any) => removeAccents(i)).join(", ")}</span>
            </div>
          )}
          {pref.preferredLanguage && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Spoken Language:</span>{" "}
              <span className="font-serif">
                {pref.preferredLanguage === "en" ? "English" :
                 pref.preferredLanguage === "vi" ? "Vietnamese" :
                 pref.preferredLanguage === "ja" ? "Japanese" :
                 pref.preferredLanguage === "ko" ? "Korean" :
                 pref.preferredLanguage === "zh" ? "Chinese" : removeAccents(pref.preferredLanguage)}
              </span>
            </div>
          )}
          {pref.leadershipTrack && pref.leadershipTrack !== "undecided" && (
            <div>
              <span className="font-bold text-neutral-900 font-serif">Leadership Track:</span>{" "}
              <span className="font-serif">
                {pref.leadershipTrack === "management" ? "Engineering Management" : "Individual Contributor"}
              </span>
            </div>
          )}
          {pref.workPreferenceNotes && (
            <div className="col-span-2 mt-0.5">
              <span className="font-bold text-neutral-900 font-serif">Notes:</span>{" "}
              <span className="italic font-serif">{removeAccents(pref.workPreferenceNotes)}</span>
            </div>
          )}
        </div>
      }
    />
  );
};

// ---------------------------------------------------------
// Templates Registry
// ---------------------------------------------------------

export const CV_TEMPLATES: Record<string, CvTemplate> = {
  professional: {
    id: "professional",
    name: "Professional (Default)",
    version: 1,
    className: "cv-template-professional",
    layout: {
      layoutStyle: "single-column",
      fullWidthTop: ["header"],
      columnMapping: {
        sidebar: [],
        main: [] // Default: single stream
      }
    }
  },
  modern: {
    id: "modern",
    name: "Modern (Asymmetric)",
    version: 1,
    className: "cv-template-modern",
    layout: {
      layoutStyle: "two-column-left",
      sidebarWidth: 200,
      mainWidth: 428,
      gapWidth: 14,
      blockGap: 6,
      fullWidthTop: ["header"],
      columnMapping: {
        sidebar: [
          "contact",
          "section-title-skills",
          "skills-content",
          "section-title-preferences",
          "preferences-content"
        ],
        main: [
          "section-title-summary",
          "summary-paragraph-",
          "section-title-experience",
          "exp-",
          "section-title-projects",
          "proj-",
          "section-title-education",
          "edu-",
          "section-title-achievements",
          "ach-"
        ]
      }
    },
    overrides: {
      header: ModernHeader,
      contact: ModernContact,
      "section-title": ModernSectionTitle,
      "tech-list": ModernTechList,
      "entry-header": ModernEntryHeader,
      "bullet-point": ModernBulletPoint,
      "preferences-grid": ModernPreferencesGrid,
      paragraph: ModernParagraph
    }
  },
  minimal: {
    id: "minimal",
    name: "Minimal (Spacious)",
    version: 1,
    className: "cv-template-minimal",
    layout: {
      layoutStyle: "single-column",
      fullWidthTop: ["header"],
      columnMapping: {
        sidebar: [],
        main: []
      }
    },
    overrides: {
      header: MinimalHeader,
      "section-title": MinimalSectionTitle,
      "entry-header": MinimalEntryHeader
    }
  },
  executive: {
    id: "executive",
    name: "Executive (Serif)",
    version: 1,
    className: "cv-template-executive",
    layout: {
      layoutStyle: "single-column",
      fullWidthTop: ["header"],
      columnMapping: {
        sidebar: [],
        main: []
      }
    },
    overrides: {
      header: ExecutiveHeader,
      contact: ExecutiveContact,
      "section-title": ExecutiveSectionTitle,
      "entry-header": ExecutiveEntryHeader,
      paragraph: ExecutiveParagraph,
      "bullet-point": ExecutiveBulletPoint,
      "tech-list": ExecutiveTechList,
      "preferences-grid": ExecutivePreferencesGrid
    }
  }
};

export const DEFAULT_TEMPLATE_ID = "professional";

export function getTemplate(id: string): CvTemplate {
  return CV_TEMPLATES[id] || CV_TEMPLATES[DEFAULT_TEMPLATE_ID];
}
