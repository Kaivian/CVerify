import React, { useState } from "react";
import { Modal, Typography, Tabs, Button } from "@heroui/react";
import { X, LayoutDashboard, ShieldCheck, Cpu, Users, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RepositoryAnalysis } from "@/types/repository-analysis.types";
import { AnalysisScoreCards } from "./AnalysisScoreCards";
import { MetricCards } from "./MetricCards";
import { TechnologyTags } from "./TechnologyTags";
import { InsightSections } from "./InsightSections";
import { RecommendationPanels } from "./RecommendationPanels";
import { VerificationSignals } from "./VerificationSignals";
import { SkillTreeVisualization } from "./SkillTreeVisualization";

interface DetailedAnalysisModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  analysis: RepositoryAnalysis | null;
}

type TabId = "overview" | "verification" | "engineering" | "contributors" | "recommendations";

export const DetailedAnalysisModal: React.FC<DetailedAnalysisModalProps> = ({
  isOpen,
  onOpenChange,
  analysis,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  if (!analysis) return null;

  const tabsList = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "verification", label: "Verification & Trust", icon: ShieldCheck },
    { id: "engineering", label: "Engineering", icon: Cpu },
    { id: "contributors", label: "Contributors & Activity", icon: Users },
    { id: "recommendations", label: "Recommendations", icon: Award },
  ];

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 z-[100]"
    >
      <Modal.Container size="cover">
        <Modal.Dialog className="w-full max-w-5xl bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden my-8 max-h-[90vh] overflow-y-auto">
          {/* Close Trigger */}
          <Modal.CloseTrigger
            aria-label="Close dialog"
            className="absolute right-6 top-6 p-1.5 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors z-10"
          >
            <X size={16} />
          </Modal.CloseTrigger>

          {/* Modal Header */}
          <Modal.Header className="mb-4 pr-10">
            <Modal.Heading className="outline-hidden text-left">
              <span className="text-[10px] text-accent uppercase font-extrabold tracking-wider block mb-1">
                AI Repository Intelligence Report
              </span>
              <Typography type="h3" className="font-extrabold text-foreground font-display select-all text-xl">
                {analysis.repo.full_name}
              </Typography>
            </Modal.Heading>
          </Modal.Header>

          {/* Modal Content */}
          <Modal.Body className="space-y-6 text-sm leading-relaxed text-muted-foreground select-text py-2">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as TabId)}
              variant="secondary"
              className="w-full"
            >
              <Tabs.ListContainer className="border-b border-border/20 mb-4 pb-0.5">
                <Tabs.List aria-label="Report navigation sections" className="flex gap-4">
                  {tabsList.map((t) => {
                    const Icon = t.icon;
                    return (
                      <Tabs.Tab
                        key={t.id}
                        id={t.id}
                        className="flex items-center gap-1.5 pb-2.5 text-xs font-semibold cursor-pointer outline-hidden border-none"
                      >
                        <Icon size={14} className="shrink-0" />
                        <span>{t.label}</span>
                        <Tabs.Indicator className="bottom-0 h-0.5" />
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>
              </Tabs.ListContainer>

              <div className="min-h-[400px]">
                <Tabs.Panel id="overview" className="p-0 space-y-6">
                  {activeTab === "overview" && (
                    <>
                      {/* Executive summary & stats */}
                      <div className="p-5 border border-border/80 bg-surface-secondary/20 rounded-2xl">
                        <Typography type="body-sm" className="font-bold text-foreground block mb-2">
                          Executive Evaluation Summary
                        </Typography>
                        <Typography type="body-xs" className="text-muted leading-relaxed font-light">
                          {analysis.scoring.recruiter_summary}
                        </Typography>
                      </div>

                      <AnalysisScoreCards analysis={analysis} />
                      <InsightSections analysis={analysis} />
                    </>
                  )}
                </Tabs.Panel>

                <Tabs.Panel id="verification" className="p-0">
                  {activeTab === "verification" && <VerificationSignals analysis={analysis} />}
                </Tabs.Panel>

                <Tabs.Panel id="engineering" className="p-0 space-y-6">
                  {activeTab === "engineering" && (
                    <>
                      <SkillTreeVisualization analysis={analysis} />
                      <div className="border border-border/80 bg-surface p-5 rounded-2xl">
                        <Typography type="body-sm" className="font-bold text-foreground block mb-3">
                          Repository Technology Stack Breakdown
                        </Typography>
                        <TechnologyTags analysis={analysis} />
                      </div>
                    </>
                  )}
                </Tabs.Panel>

                <Tabs.Panel id="contributors" className="p-0 space-y-6">
                  {activeTab === "contributors" && (
                    <>
                      <MetricCards analysis={analysis} />
                      
                      {/* Detailed activity summary */}
                      <Card className="p-5 border border-border/80 bg-surface rounded-2xl" glow={false}>
                        <Typography type="body-sm" className="font-bold text-foreground block mb-3">
                          Contributor Collaboration Details
                        </Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed font-light text-muted">
                          <div className="space-y-2">
                            <div>
                              <span className="font-bold text-foreground">Contribution Ratio: </span>
                              The current user is responsible for <strong>{analysis.contribution_stats.user_commit_pct}%</strong> of all commits in this repository.
                            </div>
                            <div>
                              <span className="font-bold text-foreground">Commit Profile: </span>
                              Total commits is <strong>{analysis.contribution_stats.total_commits}</strong>, with <strong>{analysis.contribution_stats.user_commits}</strong> authored by the target developer profile.
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="font-bold text-foreground">Branch Management: </span>
                              Codebase is deployed across <strong>{analysis.contribution_stats.branches_count}</strong> active branches with <strong>{analysis.repo.open_prs}</strong> open pull requests.
                            </div>
                            <div>
                              <span className="font-bold text-foreground">Collaboration Footprint: </span>
                              Analysis identified <strong>{analysis.contribution_stats.contributors_count}</strong> active contributors involved in writing or reviewing code.
                            </div>
                          </div>
                        </div>
                      </Card>
                    </>
                  )}
                </Tabs.Panel>

                <Tabs.Panel id="recommendations" className="p-0">
                  {activeTab === "recommendations" && <RecommendationPanels analysis={analysis} />}
                </Tabs.Panel>
              </div>
            </Tabs>
          </Modal.Body>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-separator">
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold px-4 h-9"
              variant="secondary"
            >
              Close Report
            </Button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
export default DetailedAnalysisModal;
