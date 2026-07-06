import { useState, useEffect, useRef, useMemo, useId } from "react";
import {
  type ExperienceDraftItem,
  type EducationDraftItem,
  type AchievementsDraftItem,
  type PreferencesDraft,
} from "../components/types";

export interface CvPaginationData {
  basic: Record<string, any>;
  summary: Record<string, any>;
  skills: Record<string, any>;
  experience: Record<string, any>[];
  education: Record<string, any>[];
  achievements: Record<string, any>[];
  preferences: Record<string, any>;
  projects?: Record<string, any>[];
}

export interface LayoutBlock {
  id: string;
  type:
    | "header"
    | "section-title"
    | "entry-header"
    | "paragraph"
    | "bullet-point"
    | "tech-list"
    | "preferences-grid";
  hash: string;
  data: Record<string, any>;
}

export interface PageModel {
  pageNumber: number;
  totalPages: number;
  blocks: LayoutBlock[];
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

// Clean social link protocol
const formatSocialLink = (url: string): string => {
  if (!url) return "";
  return url.replace(/^(https?:\/\/)?(www\.)?/, "");
};

// Categorize skills list
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

// Fallback heights for server-side rendering or when DOM measurement isn't ready
const getFallbackHeight = (block: LayoutBlock): number => {
  switch (block.type) {
    case "header":
      return 150;
    case "section-title":
      return 36;
    case "entry-header":
      return 45;
    case "paragraph":
      return 40;
    case "bullet-point":
      return 22;
    case "tech-list":
      return 35;
    case "preferences-grid":
      return 120;
    default:
      return 30;
  }
};

export function useCvPagination(
  cvData: CvPaginationData,
  pageHeightLimit: number = 920,
  gapHeight: number = 12
) {
  const uniqueId = useId();
  const [pages, setPages] = useState<PageModel[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(794);

  // Height cache keyed by content hash
  const heightCache = useRef<Record<string, number>>({});
  const measurerRef = useRef<HTMLDivElement | null>(null);

  // Check font readiness
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.fonts.ready.then(() => {
      setFontsReady(true);
    });
  }, []);

  // 1. Generate Layout Blocks from CV data
  const blocks = useMemo<LayoutBlock[]>(() => {
    const items: LayoutBlock[] = [];
    const basic = cvData.basic;
    const summary = cvData.summary;
    const skills = cvData.skills;
    const experience = cvData.experience as ExperienceDraftItem[];
    const education = cvData.education as EducationDraftItem[];
    const achievements = cvData.achievements as AchievementsDraftItem[];
    const preferences = cvData.preferences as PreferencesDraft;
    const projects = cvData.projects || [];

    // Parse AI Suggestion status
    let isAiHeadline = false;
    let matchScore: number | undefined = undefined;
    let isAiBio = false;

    if (basic.aiSuggestionsJson) {
      try {
        const suggestionsMap = JSON.parse(basic.aiSuggestionsJson);
        const headlineSuggestion = suggestionsMap.headline;
        isAiHeadline = headlineSuggestion?.source === "ai";
        matchScore = headlineSuggestion?.matchScore;

        const bioSuggestion = suggestionsMap.bio;
        isAiBio = bioSuggestion?.source === "ai";
      } catch (e) {
        console.error("Failed to parse aiSuggestionsJson in useCvPagination:", e);
      }
    }

    const createBlock = (
      id: string,
      type: LayoutBlock["type"],
      data: Record<string, any>
    ): LayoutBlock => ({
      id,
      type,
      data,
      hash: JSON.stringify(data),
    });

    // A. Header block
    items.push(
      createBlock("header", "header", {
        fullName: basic.fullName,
        headline: basic.headline,
        publicEmail: basic.publicEmail,
        phoneNumber: basic.phoneNumber,
        location: basic.location,
        birthDate: basic.birthDate,
        socialLinks: basic.socialLinks,
        isAiHeadline,
        matchScore,
      })
    );

    // B. Career Summary block
    if (summary.bio) {
      items.push(
        createBlock("section-title-summary", "section-title", {
          title: "Career Objective / Summary",
          isAi: isAiBio,
        })
      );
      // Split bio by double-newlines to support paragraph layout blocks
      const paragraphs = (summary.bio as string).split(/\r?\n\r?\n/).filter(Boolean);
      paragraphs.forEach((para, idx) => {
        items.push(
          createBlock(`summary-paragraph-${idx}`, "paragraph", {
            text: para,
          })
        );
      });
    }

    // C. Experience blocks
    if (experience && experience.length > 0) {
      items.push(
        createBlock("section-title-experience", "section-title", {
          title: "Work Experience",
        })
      );
      experience.forEach((exp: ExperienceDraftItem) => {
        const start = formatMonthYear(exp.startDate);
        const end = exp.isCurrentlyWorking ? "Present" : formatMonthYear(exp.endDate);

        items.push(
          createBlock(`exp-header-${exp.id}`, "entry-header", {
            title: exp.jobTitle,
            dateRange: start && end ? `${start} - ${end}` : (start || end || ""),
            subtitle: `${exp.company}${exp.location ? ` • ${exp.location}` : ""}`,
          })
        );

        if (exp.description) {
          const lines = exp.description
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          lines.forEach((line, idx) => {
            items.push(
              createBlock(`exp-bullet-${exp.id}-${idx}`, "bullet-point", {
                text: line.replace(/^[•\*\-\u25e6]\s*/, ""),
              })
            );
          });
        }

        if (exp.achievements && exp.achievements.length > 0) {
          exp.achievements.forEach((ach, idx) => {
            items.push(
              createBlock(`exp-ach-${exp.id}-${idx}`, "bullet-point", {
                text: ach.description,
                prefix: ach.title,
              })
            );
          });
        }

        if (exp.technologies && exp.technologies.length > 0) {
          items.push(
            createBlock(`exp-tech-${exp.id}`, "tech-list", {
              label: "Technologies",
              items: exp.technologies,
            })
          );
        }

        if (exp.links && exp.links.length > 0) {
          exp.links.forEach((link, idx) => {
            items.push(
              createBlock(`exp-link-${exp.id}-${idx}`, "bullet-point", {
                text: formatSocialLink(link.url),
                url: link.url,
                isLink: true,
              })
            );
          });
        }
      });
    }

    // E. Projects blocks
    const normalizedProjects = projects.map((p: Record<string, any>) => {
      if (p.verificationLevel !== undefined) {
        const start = formatMonthYear(p.startDate);
        const end = p.isCurrentlyWorking ? "Present" : formatMonthYear(p.endDate);
        const numLevel = typeof p.verificationLevel === "string"
          ? (p.verificationLevel === "AiAnalyzed" ? 1 : p.verificationLevel === "RepositoryLinked" ? 2 : 3)
          : p.verificationLevel;
        const numStatus = typeof p.verificationStatus === "string"
          ? (p.verificationStatus === "Verified" ? 1 : p.verificationStatus === "Outdated" ? 2 : p.verificationStatus === "Disconnected" ? 3 : 4)
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

      // Legacy fallback
      const isRealRepo = p.createdAtUtc !== undefined;
      if (isRealRepo) {
        const start = formatMonthYear(p.createdAtUtc);
        const end = p.lastCommitAt ? formatMonthYear(p.lastCommitAt) : "Present";
        const techList = p.primaryLanguage ? [p.primaryLanguage] : (p.cvSynthesis?.skills || []);
        const highlightsList = p.cvSynthesis?.highlights?.map((h: Record<string, any>) => h.impact ? `${h.signal}: ${h.impact}` : h.signal) || [];
        return {
          id: p.id,
          name: p.name,
          dateRange: `${start} - ${end}`,
          description: p.description || "",
          technologies: techList,
          role: p.cvSynthesis?.ownershipProfile || "Contributor",
          contributions: highlightsList,
          verificationLevel: 1,
          verificationStatus: 1,
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
          verificationLevel: 3,
          verificationStatus: 4,
        };
      }
    });

    if (normalizedProjects.length > 0) {
      items.push(
        createBlock("section-title-projects", "section-title", {
          title: "Linked Projects",
        })
      );
      normalizedProjects.forEach((proj) => {
        items.push(
          createBlock(`proj-header-${proj.id}`, "entry-header", {
            title: proj.name,
            dateRange: proj.dateRange,
            subtitle: proj.role || "Contributor",
            verificationLevel: proj.verificationLevel,
            verificationStatus: proj.verificationStatus,
          })
        );

        if (proj.description) {
          items.push(
            createBlock(`proj-desc-${proj.id}`, "paragraph", {
              text: proj.description,
              isItalic: true,
            })
          );
        }

        if (proj.technologies && proj.technologies.length > 0) {
          items.push(
            createBlock(`proj-tech-${proj.id}`, "tech-list", {
              label: "Technologies",
              items: proj.technologies,
            })
          );
        }

        if (proj.contributions && proj.contributions.length > 0) {
          proj.contributions.forEach((contrib: string, idx: number) => {
            items.push(
              createBlock(`proj-contrib-${proj.id}-${idx}`, "bullet-point", {
                text: contrib,
                isCircle: true,
              })
            );
          });
        }
      });
    }

    // D. Education blocks
    if (education && education.length > 0) {
      items.push(
        createBlock("section-title-education", "section-title", {
          title: "Education & Credentials",
        })
      );
      education.forEach((edu: EducationDraftItem) => {
        const eduAny = edu as any;
        const schoolName = eduAny.schoolName || eduAny.school || "";
        const startDate = eduAny.startDate || eduAny.period?.start?.toString() || "";
        const endDate = eduAny.endDate || eduAny.period?.end?.toString() || "";
        const start = formatMonthYear(startDate);
        const end = edu.isCurrentlyStudying ? "Present" : formatMonthYear(endDate);

        items.push(
          createBlock(`edu-header-${edu.id}`, "entry-header", {
            title: `${schoolName}${edu.label ? ` - ${edu.label}` : ""}`,
            dateRange: start && end ? `${start} - ${end}` : (start || end || ""),
            subtitle: `${edu.degree || ""}${edu.major ? `${edu.degree ? " - " : ""}${edu.major}` : ""}`,
            rightSubtitle: edu.gpa ? `GPA: ${edu.gpa}/${edu.gpaScale || 4.0}` : undefined,
          })
        );

        if (edu.description) {
          const lines = edu.description
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          lines.forEach((line, idx) => {
            items.push(
              createBlock(`edu-desc-${edu.id}-${idx}`, "paragraph", {
                text: line.replace(/^[•\*\-\u25e6]\s*/, ""),
              })
            );
          });
        }
      });
    }

    // F. Skills blocks
    const hasSkills = skills.targetSkills && skills.targetSkills.length > 0;
    const categorizedSkills = hasSkills ? categorizeSkills(skills.targetSkills) : {};

    if (hasSkills) {
      items.push(
        createBlock("section-title-skills", "section-title", {
          title: "Technical Skills",
        })
      );
      items.push(
        createBlock("skills-content", "tech-list", {
          categorizedSkills,
          flatSkills: skills.targetSkills,
        })
      );
    }

    // G. Achievements blocks
    if (achievements && achievements.length > 0) {
      items.push(
        createBlock("section-title-achievements", "section-title", {
          title: "Achievements & Certificates",
        })
      );
      achievements.forEach((ach) => {
        items.push(
          createBlock(`ach-header-${ach.id}`, "entry-header", {
            title: ach.title,
            dateRange: formatMonthYear(ach.issueDate),
            subtitle: `Issued by: ${ach.issuer}`,
            credentialUrl: ach.credentialUrl || null,
          })
        );

        if (ach.description) {
          const lines = ach.description
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          lines.forEach((line, idx) => {
            items.push(
              createBlock(`ach-desc-${ach.id}-${idx}`, "paragraph", {
                text: line.replace(/^[•\*\-\u25e6]\s*/, ""),
              })
            );
          });
        }
      });
    }

    // H. Preferences block
    const hasPreferences =
      preferences.openToWorkStatus ||
      (preferences.desiredJobPositions && preferences.desiredJobPositions.length > 0) ||
      preferences.expectedSalaryMin ||
      preferences.remotePreference ||
      (preferences.preferredLocations && preferences.preferredLocations.length > 0) ||
      (preferences.employmentPreferences && preferences.employmentPreferences.length > 0);

    if (hasPreferences) {
      items.push(
        createBlock("section-title-preferences", "section-title", {
          title: "Career Preferences",
        })
      );
      items.push(
        createBlock("preferences-content", "preferences-grid", {
          preferences,
        })
      );
    }

    return items;
  }, [cvData]);

  // Observer to handle width scaling / zoom resets
  useEffect(() => {
    if (typeof window === "undefined" || !measurerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width || 794;
        // Ignore height variations, recalculate pagination on width changes
        setContainerWidth((prev) => {
          if (prev !== width) {
            return width;
          }
          return prev;
        });
      }
    });

    observer.observe(measurerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Pagination Algorithm Loop (Debounced to keep typing smooth)
  useEffect(() => {
    if (!fontsReady) return;

    const runPagination = () => {
      // Step A: DOM measurements
      const measuredHeights: Record<string, number> = {};

      blocks.forEach((block) => {
        const cachedHeight = heightCache.current[block.hash];
        if (cachedHeight !== undefined) {
          measuredHeights[block.id] = cachedHeight;
          return;
        }

        const el = document.getElementById(`${uniqueId}-measurer-${block.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const height = rect.height || el.offsetHeight || getFallbackHeight(block);
          measuredHeights[block.id] = height;
          // Store in cache
          heightCache.current[block.hash] = height;
        } else {
          // Fallback height if element not present
          measuredHeights[block.id] = getFallbackHeight(block);
        }
      });

      // Step B: Partition blocks into pages
      const calculatedPages: PageModel[] = [];
      let currentPageBlocks: LayoutBlock[] = [];
      let currentPageHeight = 0;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockHeight = measuredHeights[block.id] || getFallbackHeight(block);
        const effectiveHeight =
          currentPageBlocks.length === 0 ? blockHeight : blockHeight + gapHeight;

        // Orphan Heading Prevention Strategy
        if (block.type === "section-title") {
          let lookAheadHeight = effectiveHeight;
          let nextIdx = i + 1;

          // Pull heading + subsequent header + first item of that block
          while (nextIdx < blocks.length && nextIdx <= i + 2) {
            const nextBlock = blocks[nextIdx];
            const nextHeight =
              measuredHeights[nextBlock.id] || getFallbackHeight(nextBlock);
            lookAheadHeight += nextHeight + gapHeight;
            nextIdx++;
          }

          if (
            currentPageHeight + lookAheadHeight > pageHeightLimit &&
            currentPageBlocks.length > 0
          ) {
            calculatedPages.push({
              pageNumber: calculatedPages.length + 1,
              totalPages: 0,
              blocks: currentPageBlocks,
            });
            currentPageBlocks = [block];
            currentPageHeight = blockHeight;
          } else {
            currentPageBlocks.push(block);
            currentPageHeight += effectiveHeight;
          }
        }
        // Orphan Entry Header Prevention
        else if (block.type === "entry-header") {
          let lookAheadHeight = effectiveHeight;
          if (i + 1 < blocks.length) {
            const nextBlock = blocks[i + 1];
            const nextHeight =
              measuredHeights[nextBlock.id] || getFallbackHeight(nextBlock);
            lookAheadHeight += nextHeight + gapHeight;
          }

          if (
            currentPageHeight + lookAheadHeight > pageHeightLimit &&
            currentPageBlocks.length > 0
          ) {
            calculatedPages.push({
              pageNumber: calculatedPages.length + 1,
              totalPages: 0,
              blocks: currentPageBlocks,
            });
            currentPageBlocks = [block];
            currentPageHeight = blockHeight;
          } else {
            currentPageBlocks.push(block);
            currentPageHeight += effectiveHeight;
          }
        }
        // Normal block
        else {
          if (
            currentPageHeight + effectiveHeight > pageHeightLimit &&
            currentPageBlocks.length > 0
          ) {
            calculatedPages.push({
              pageNumber: calculatedPages.length + 1,
              totalPages: 0,
              blocks: currentPageBlocks,
            });
            currentPageBlocks = [block];
            currentPageHeight = blockHeight;
          } else {
            currentPageBlocks.push(block);
            currentPageHeight += effectiveHeight;
          }
        }
      }

      if (currentPageBlocks.length > 0) {
        calculatedPages.push({
          pageNumber: calculatedPages.length + 1,
          totalPages: 0,
          blocks: currentPageBlocks,
        });
      }

      // Populate total pages
      calculatedPages.forEach((p) => {
        p.totalPages = calculatedPages.length;
      });

      setPages(calculatedPages);
      setIsReady(true);
    };

    // Recalculate layout on next paint loop, debounced by 150ms to keep editor UI snappy
    const debounceTimer = setTimeout(() => {
      requestAnimationFrame(runPagination);
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [blocks, fontsReady, pageHeightLimit, gapHeight, containerWidth, uniqueId]);

  return {
    pages,
    isReady,
    measurerRef,
    blocks,
    uniqueId,
  };
}
