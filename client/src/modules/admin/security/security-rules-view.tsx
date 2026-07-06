import React, { useState, useEffect } from "react";
import { securityAdminService } from "@/services/security-admin.service";
import { type SecurityRule } from "@/types/security.types";
import { Card, Button, Typography, Spinner, toast } from "@heroui/react";
import { Sliders, Save, CheckCircle, XCircle } from "lucide-react";

export function SecurityRulesView() {
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  // Edit state
  const [isEnabled, setIsEnabled] = useState(false);
  const [severity, setSeverity] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const data = await securityAdminService.getSecurityRules();
      setRules(data);
    } catch (err) {
      console.error("Failed to load security rules", err);
      toast.danger("Failed to load threat detection rules.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleStartEdit = (rule: SecurityRule) => {
    setEditingRuleId(rule.id);
    setIsEnabled(rule.isEnabled);
    setSeverity(rule.severity);
    setConfigJson(rule.configurationJson);
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
  };

  const handleSave = async (id: string) => {
    // Validate JSON
    try {
      JSON.parse(configJson);
    } catch (err) {
      toast.danger("Invalid Configuration JSON formatting.");
      return;
    }

    setIsSaving(true);
    try {
      await securityAdminService.updateSecurityRule(id, {
        isEnabled,
        severity,
        configurationJson: configJson
      });
      toast.success("Detection rule updated successfully.");
      setEditingRuleId(null);
      await fetchRules();
    } catch (err) {
      toast.danger("Failed to update security rule configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const getSeverityStyle = (sev: string) => {
    const s = sev.toUpperCase();
    if (s === "CRITICAL") return "bg-danger/10 text-danger border border-danger/20 font-bold";
    if (s === "HIGH") return "bg-warning/10 text-warning border border-warning/20 font-bold";
    if (s === "MEDIUM") return "bg-accent/10 text-accent border border-accent/20";
    return "bg-default/10 text-foreground border border-default/20";
  };

  return (
    <div className="space-y-6 text-foreground font-outfit max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography
            type="h2"
            className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2 font-display"
          >
            <Sliders className="text-accent" size={24} />
            Threat Detection Rules
          </Typography>
          <Typography type="body-sm" className="text-muted mt-1">
            Configure dynamic rules, geovelocity anomaly bounds, and lockouts for anomalous candidate or admin behavior.
          </Typography>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted text-xs">
          <Spinner size="md" />
          <span>Loading detection engine heuristics...</span>
        </div>
      ) : rules.length === 0 ? (
        <Card className="p-10 text-center text-muted text-xs border border-border">
          No threat detection rules seeded in database.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule) => {
            const isEditing = editingRuleId === rule.id;
            return (
              <Card 
                key={rule.id}
                className={`p-5 bg-surface border rounded-2xl shadow-surface space-y-4 flex flex-col justify-between transition-all ${
                  isEditing ? "border-accent/40 ring-1 ring-accent/20" : "border-border hover:border-border-hover"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[10px] text-muted font-mono block">Code: {rule.code}</span>
                      <h3 className="text-sm font-extrabold text-foreground font-display mt-0.5">
                        {rule.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <select
                          value={severity}
                          onChange={(e) => setSeverity(e.target.value)}
                          className="rounded-xl border border-border bg-surface text-[10px] p-1.5 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] uppercase tracking-wide ${getSeverityStyle(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      )}

                      {isEditing ? (
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-muted select-none">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => setIsEnabled(e.target.checked)}
                            className="rounded border-border bg-surface text-accent focus:ring-accent h-3.5 w-3.5"
                          />
                          Active
                        </label>
                      ) : rule.isEnabled ? (
                        <span className="flex items-center gap-1 text-success text-[10px]">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted text-[10px]">
                          <XCircle size={12} /> Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">
                    {rule.description}
                  </p>

                  {/* Configuration Block */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Rule Parameters</span>
                    {isEditing ? (
                      <textarea
                        value={configJson}
                        onChange={(e) => setConfigJson(e.target.value)}
                        rows={5}
                        className="w-full font-mono text-[10px] p-2.5 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                      />
                    ) : (
                      <pre className="p-3 bg-surface-secondary/50 border border-separator/40 rounded-xl font-mono text-[10px] text-muted overflow-x-auto max-h-36">
                        {JSON.stringify(JSON.parse(rule.configurationJson), null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-separator/40 mt-4">
                  {isEditing ? (
                    <>
                      <Button
                        variant="secondary"
                        onPress={handleCancelEdit}
                        isDisabled={isSaving}
                        className="px-3.5 py-2 bg-surface border border-border text-foreground rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-surface-secondary select-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        onPress={() => handleSave(rule.id)}
                        isDisabled={isSaving}
                        className="px-3.5 py-2 bg-foreground text-background font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-foreground/90 select-none"
                      >
                        {isSaving ? <Spinner size="sm" /> : <Save size={12} />}
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      onPress={() => handleStartEdit(rule)}
                      className="px-3.5 py-2 bg-surface border border-border text-foreground rounded-xl text-xs cursor-pointer hover:bg-surface-secondary select-none"
                    >
                      Configure
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
