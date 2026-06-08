import React from "react";
import { Accordion, Chip, ProgressBar } from "@heroui/react";
import { Crown, Sparkles, CheckCircle2, AlertTriangle, Terminal, XCircle, AlertCircle } from "lucide-react";
import { parseAndSanitizeMarkdown } from "@/lib/markdown";

interface BentoGridDashboardProps {
  report: any;
}

const parseSectionItem = (item: any) => {
  if (item && typeof item === "object") {
    return {
      title: item.title || "Detail Item",
      content: item.content || item.description || "",
    };
  }
  const str = String(item);
  let splitIdx = str.indexOf(" - ");
  if (splitIdx !== -1) {
    return {
      title: str.substring(0, splitIdx).trim(),
      content: str.substring(splitIdx + 3).trim(),
    };
  }
  splitIdx = str.indexOf(": ");
  if (splitIdx !== -1) {
    return {
      title: str.substring(0, splitIdx).trim(),
      content: str.substring(splitIdx + 2).trim(),
    };
  }
  return {
    title: str,
    content: "",
  };
};

export const BentoGridDashboard: React.FC<BentoGridDashboardProps> = ({ report }) => {
  if (!report) return null;

  const classification = report.classification || {
    primaryDomain: "Unknown",
    subDomain: "General",
    confidence: 0,
    isVerified: false,
    trustScore: 0
  };

  const risk = report.risk || {
    score: 0,
    level: "low",
    reasons: []
  };

  const sections = report.sections || [];
  const engineeringSection = sections.find((s: any) => s.type === "engineering_practices");
  const securitySection = sections.find((s: any) => s.type === "security_findings");
  const architectureSection = sections.find((s: any) => s.type === "architecture_insights");

  const getRiskClasses = (level: string) => {
    switch (level.toLowerCase()) {
      case "high":
        return "text-danger border-danger/30 bg-danger/5";
      case "medium":
        return "text-warning border-warning/30 bg-warning/5";
      case "low":
      default:
        return "text-success border-success/30 bg-success/5";
    }
  };

  const getEvidenceStrength = (ep: number) => {
    if (ep <= 5) return `Minimal (${ep} Signals)`;
    if (ep <= 15) return `Standard (${ep} Signals)`;
    if (ep <= 35) return `Strong (${ep} Signals)`;
    return `Exceptional (${ep} Signals)`;
  };

  const hasWeightedStrength = !!report.evidenceStrength;
  const totalEvidencePoints = report.evidenceStrength?.score ?? sections.reduce((sum: number, s: any) => sum + (s.items?.length ?? 0), 0);
  const strengthLabel = report.evidenceStrength?.label ?? getEvidenceStrength(totalEvidencePoints);

  const commitsCount = report.facts?.git_metrics?.total_commits ?? 0;
  const contributorsCount = report.facts?.git_metrics?.active_contributors ?? 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left font-sans items-start w-full">
      {/* Column 1 (Left) */}
      <div className="flex flex-col gap-5">
        {/* Tier 1: Score & Verdict Card (Large) */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-4 min-h-[220px]">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
                Verification Verdict
              </span>
              <div className="flex">
                <h3 className="text-lg font-black text-foreground capitalize flex items-center gap-1.5">
                  <Crown className="size-4.5 text-warning shrink-0" />
                  {classification.primaryDomain.replace(/_/g, " ")}
                </h3>
              </div>
            </div>
            <div
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider shrink-0 ${getRiskClasses(
                risk.level
              )}`}
            >
              {risk.level} Risk
            </div>
          </div>
          <Accordion className="w-full" variant="surface">
            <Accordion.Item key="ai-summary" id="ai-summary" aria-label="AI Summary">
              <Accordion.Heading>
                <Accordion.Trigger className="text-[10.5px] font-bold text-foreground flex items-center justify-between w-full py-1.5 px-1 cursor-pointer select-none">
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-accent shrink-0" />
                    AI Detailed Report
                  </span>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="text-xs text-muted-foreground leading-relaxed pl-5.5 font-light pt-2 pb-3 select-text markdown-summary">
                  <div dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(report.narrative?.recruiter_summary || (risk.reasons.length > 0 ? risk.reasons.join(", ") : "Authentic workspace scan complete.")) }} />
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start justify-center gap-2">
              <span className="text-[9px] text-muted uppercase font-bold">Evidence Strength:</span>
              <strong className="text-sm text-foreground font-extrabold font-mono">
                {hasWeightedStrength ? `${strengthLabel} (${totalEvidencePoints.toFixed(0)} pts)` : strengthLabel}
              </strong>
            </div>
            <div className="flex flex-col items-start justify-center gap-2">
              <span className="text-[9px] text-muted uppercase font-bold">Sub-Domain:</span>
              <strong className="text-sm text-foreground font-extrabold capitalize font-sans truncate">
                {classification.subDomain.replace(/_/g, " ")}
              </strong>
            </div>
            <div className="flex flex-col items-start justify-center gap-2">
              <span className="text-[9px] text-muted uppercase font-bold">Trust Score:</span>
              <strong className="text-sm text-foreground font-extrabold font-mono">
                {(classification.trustScore * 100).toFixed(0)}%
              </strong>
            </div>
          </div>
        </div>

        {/* Tier 2: Skills & Stack Matrix */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Skills & Stack Matrix
          </span>
          <div className="space-y-3 pr-1">
            <div className="space-y-1">
              <span className="text-[8px] text-muted uppercase font-bold block">Languages</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(report.repo?.languages || {}).map(([lang, pct]: any) => (
                  <span
                    key={lang}
                    className="text-[10px] border border-border/60 bg-surface-secondary text-foreground px-2 py-0.5 rounded-md font-medium"
                  >
                    {lang} <span className="opacity-60 font-mono text-[9px]">{pct}%</span>
                  </span>
                ))}
              </div>
            </div>

            {report.repo?.topics && report.repo.topics.length > 0 && (
              <div className="space-y-1">
                <span className="text-[8px] text-accent uppercase font-extrabold block">
                  Repository Topics
                </span>
                <div className="flex flex-wrap gap-1">
                  {report.repo.topics.map((topic: string) => (
                    <span
                      key={topic}
                      className="text-[10.5px] border border-border/60 bg-surface-secondary text-foreground px-2 py-0.5 rounded-md font-semibold"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tier 4: Security Findings */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
          <span className="text-[9px] uppercase font-extrabold tracking-wider block text-danger">
            Security Findings & Auditing
          </span>
          <div className="flex flex-col gap-2">
            {!securitySection || !securitySection.items || securitySection.items.length === 0 ? (
              <div className="text-xs text-muted-foreground italic font-light py-2">
                No high-risk secrets leaks or security violations detected.
              </div>
            ) : (
              <Accordion className="w-full" variant="surface">
                {securitySection.items.map((item: any, idx: number) => {
                  const parsed = parseSectionItem(item);
                  return (
                    <Accordion.Item key={idx}>
                      <Accordion.Heading>
                        <Accordion.Trigger className="text-[10.5px] font-semibold text-danger flex items-center justify-between w-full">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="size-3.5 text-danger shrink-0" />
                            {parsed.title}
                          </span>
                          <Accordion.Indicator />
                        </Accordion.Trigger>
                      </Accordion.Heading>
                      <Accordion.Panel>
                        <Accordion.Body className="text-[10.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2">
                          {parsed.content || parsed.title}
                        </Accordion.Body>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>

        {/* Tier 3: Contributor Distributions */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3.5 min-h-[200px]">
          <div className="flex justify-between items-center border-b border-border/20 pb-2">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Contributor Distributions
            </span>
            <span className="text-[10px] text-muted font-light">
              Bus Factor: <strong>{report.facts?.git_metrics?.bus_factor ?? 1}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5 bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40">
              <span className="text-[8.5px] text-muted uppercase font-bold block">Total Commits</span>
              <strong className="text-lg text-foreground font-black font-mono">
                {commitsCount}
              </strong>
            </div>
            <div className="space-y-0.5 bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40">
              <span className="text-[8.5px] text-muted uppercase font-bold block">User Commits</span>
              <strong className="text-lg text-foreground font-black font-mono">
                {((report.facts?.git_metrics?.user_commit_ratio ?? 1) * 100).toFixed(0)}%
              </strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[8px] text-muted uppercase font-extrabold block">Top Commit Authors</span>
            <div className="space-y-1.5 pr-1">
              {(report.facts?.git_metrics?.contributor_distribution || []).slice(0, 3).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground truncate max-w-[150px]">
                    {item.author}
                  </span>
                  <span className="font-mono text-muted text-[10px]">
                    {item.commits || 0} commits ({(item.pct || 0).toFixed(1)}%)
                  </span>
                </div>
              ))}
              {(!report.facts?.git_metrics?.contributor_distribution ||
                report.facts.git_metrics.contributor_distribution.length === 0) && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Target Developer</span>
                    <span className="font-mono text-muted text-[10px]">100.0% contribution ratio</span>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Tier 5: Scope & Quality Metrics */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Scope & Quality Metrics
          </span>
          {(() => {
            const q = report.facts?.quality_metrics || {
              files_scanned: 0,
              files_sampled: 0,
              skipped_files: 0,
              coverage_pct: 100.0,
              prompt_cache_efficiency: 0.0
            };
            return (
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="font-semibold text-foreground">Files Scanned</span>
                  <strong className="font-mono text-foreground font-extrabold">{q.files_scanned}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="font-semibold text-foreground">Files Sampled</span>
                  <strong className="font-mono text-foreground font-extrabold">{q.files_sampled}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-foreground">Cache Efficiency</span>
                  <strong className="font-mono text-foreground font-extrabold">
                    {(q.prompt_cache_efficiency * 100).toFixed(0)}%
                  </strong>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tier 5: Warnings & Observations */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 h-full">
          <span className="text-[9px] uppercase font-extrabold tracking-wider block text-warning">
            Anomalies & Warnings
          </span>
          <div className="flex flex-col gap-2 pr-1">
            {(() => {
              const uncertainty = report.trust_intelligence?.uncertainty_metrics;
              const hasFlags = (risk.reasons?.length ?? 0) > 0;
              const hasUncertaintyMetrics = uncertainty && (
                uncertainty.timestamp_compression_ratio > 0.05 ||
                uncertainty.unverified_commits > 0 ||
                uncertainty.uncalibrated_identities > 0
              );

              if (!hasFlags && !hasUncertaintyMetrics) {
                return (
                  <div className="text-xs text-muted-foreground italic font-light py-2">
                    No warnings or stylistic flags recorded.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {risk.reasons?.map((reason: string, idx: number) => (
                    <div
                      key={`reason-${idx}`}
                      className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg"
                    >
                      <strong className="font-bold">Warning:</strong> {reason}
                    </div>
                  ))}

                  {uncertainty && uncertainty.timestamp_compression_ratio > 0.05 && (
                    <div className="p-2 border border-danger/10 bg-danger/5 text-danger text-[10.5px] rounded-lg">
                      <strong className="font-bold">Violated:</strong> Suspicious commit frequency (compression ratio: {(uncertainty.timestamp_compression_ratio * 100).toFixed(1)}%). Possible automated commit spoofing or history rewrite.
                    </div>
                  )}
                  {uncertainty && uncertainty.unverified_commits > 0 && (
                    <div className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg">
                      <strong className="font-bold">Warning:</strong> Scanned {uncertainty.unverified_commits} commits lacking verified GitHub signatures.
                    </div>
                  )}
                  {uncertainty && uncertainty.uncalibrated_identities > 0 && (
                    <div className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg">
                      <strong className="font-bold">Warning:</strong> Detected {uncertainty.uncalibrated_identities} contributor email(s) not registered with GitHub API.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Column 2 (Right) */}
      <div className="flex flex-col gap-5">
        {/* Tier 1: AI Reasoning & Talent Insights */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[220px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            AI Talent Insights & Strengths
          </span>
          <div className="space-y-3 pr-1">
            {report.narrative?.top_strengths?.map((s: any, idx: number) => (
              <div key={idx} className="space-y-0.5">
                <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-accent shrink-0" />
                  {s.strength}
                </span>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed font-light pl-4">
                  {s.rationale}
                </p>
              </div>
            ))}
            {(!report.narrative?.top_strengths || report.narrative.top_strengths.length === 0) && (
              <span className="text-xs text-muted italic font-light">No specific highlights recorded.</span>
            )}
          </div>
        </div>

        {/* Tier 3: Engineering Practices & Controls */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Engineering Practices & Controls
          </span>
          <div className="flex flex-col gap-2">
            {!engineeringSection || !engineeringSection.items || engineeringSection.items.length === 0 ? (
              <div className="text-xs text-muted-foreground italic font-light py-2">
                No explicit engineering practices or control findings recorded.
              </div>
            ) : (
              <Accordion className="w-full" variant="surface">
                {engineeringSection.items.map((item: any, idx: number) => {
                  const parsed = parseSectionItem(item);
                  return (
                    <Accordion.Item key={idx}>
                      <Accordion.Heading>
                        <Accordion.Trigger className="text-[10.5px] font-semibold text-foreground flex items-center justify-between w-full">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-success shrink-0" />
                            {parsed.title}
                          </span>
                          <Accordion.Indicator />
                        </Accordion.Trigger>
                      </Accordion.Heading>
                      <Accordion.Panel>
                        <Accordion.Body className="text-[10.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2">
                          {parsed.content || parsed.title}
                        </Accordion.Body>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>

        {/* Tier 2: Architecture & Structure */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Codebase Architecture & Structure
          </span>
          <div className="flex flex-col gap-2">
            {!architectureSection || !architectureSection.items || architectureSection.items.length === 0 ? (
              <div className="text-xs text-muted-foreground italic font-light py-2">
                No codebase design or architectural insight findings recorded.
              </div>
            ) : (
              <Accordion className="w-full" variant="surface">
                {architectureSection.items.map((item: any, idx: number) => {
                  const parsed = parseSectionItem(item);
                  return (
                    <Accordion.Item key={idx}>
                      <Accordion.Heading>
                        <Accordion.Trigger className="text-[10.5px] font-semibold text-foreground flex items-center justify-between w-full">
                          <span className="flex items-center gap-2">
                            <Terminal className="size-3.5 text-accent shrink-0" />
                            {parsed.title}
                          </span>
                          <Accordion.Indicator />
                        </Accordion.Trigger>
                      </Accordion.Heading>
                      <Accordion.Panel>
                        <Accordion.Body className="text-[10.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2">
                          {parsed.content || parsed.title}
                        </Accordion.Body>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>

        {/* Tier 4: Reliability Index */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Reliability & Trust Calibration
          </span>
          {(() => {
            const score = Math.round(classification.confidence * 100);
            const completeness =
              report.facts?.quality_metrics?.files_sampled
                ? report.facts.quality_metrics.files_sampled /
                Math.max(1, report.facts.quality_metrics.files_scanned)
                : 1.0;
            const uncertainty = report.trust_intelligence?.uncertainty_metrics || {
              variance: 0,
              sampling_bias_risk: 0,
              adversarial_manipulation_risk: 0
            };
            return (
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="font-semibold text-foreground">Reliability Score</span>
                  <strong
                    className={`font-mono font-extrabold ${score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger"}`}
                  >
                    {score}%
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="font-semibold text-foreground">Completeness</span>
                  <strong className="font-mono text-foreground font-extrabold">
                    {(completeness * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="font-semibold text-foreground">Statistical Variance</span>
                  <strong className="font-mono text-foreground font-extrabold">
                    {uncertainty.variance}%
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="font-semibold text-foreground">Sampling Bias Risk</span>
                  <strong className="font-mono text-foreground font-extrabold">
                    {(uncertainty.sampling_bias_risk * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-foreground">Adversarial Risk</span>
                  <strong
                    className={`font-mono font-extrabold ${uncertainty.adversarial_manipulation_risk > 30 ? "text-danger" : "text-success"}`}
                  >
                    {uncertainty.adversarial_manipulation_risk}%
                  </strong>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
