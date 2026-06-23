"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Typography, Chip } from "@heroui/react";
import { Bookmark, Search, MapPin, Building2, User, Compass } from "lucide-react";
import { TrustScoreBadge } from "@/components/ui/cverify/trust-score-indicator";

interface SavedCandidate {
  id: string;
  name: string;
  headline: string;
  location: string;
  trustScore: number;
  skills: string[];
}

const INITIAL_SAVED_CANDIDATES: SavedCandidate[] = [
  {
    id: "cand-1",
    name: "Alex Rivera",
    headline: "Senior Backend Engineer | Rust & Go",
    location: "Remote, US",
    trustScore: 94,
    skills: ["Rust", "Go", "Kubernetes", "PostgreSQL"],
  },
  {
    id: "cand-2",
    name: "Minh Nguyen",
    headline: "Fullstack Developer | React & Node.js",
    location: "Hanoi, Vietnam",
    trustScore: 89,
    skills: ["React", "TypeScript", "Node.js", "MongoDB"],
  },
  {
    id: "cand-3",
    name: "Sophia Martinez",
    headline: "AI Research Engineer | PyTorch & NLP",
    location: "San Francisco, CA",
    trustScore: 96,
    skills: ["Python", "PyTorch", "NLP", "Transformers"],
  }
];

export default function TalentPoolPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const [savedCandidates, setSavedCandidates] = useState<SavedCandidate[]>(INITIAL_SAVED_CANDIDATES);

  const handleRemove = (id: string) => {
    setSavedCandidates(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <Bookmark size={24} className="text-accent" />
            Talent Pool
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Organization-wide saved candidates, bookmarked engineers, and curated developer lists.
          </Typography>
        </div>
        <Button
          onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
          className="bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-xl px-4 py-2 cursor-pointer border-none flex items-center gap-1.5 shrink-0"
        >
          <Compass size={14} /> Search Registry
        </Button>
      </div>

      {/* Candidates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {savedCandidates.length === 0 ? (
          <Card className="col-span-full p-12 text-center border border-dashed border-border/85 bg-surface select-none">
            <Typography type="body-xs" className="text-muted italic mb-4">
              Your talent pool is currently empty. Start discovering verified engineers using Global Candidate Search.
            </Typography>
            <Button
              onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
              className="bg-foreground text-background font-bold rounded-xl px-5 py-2 cursor-pointer border-none"
            >
              Discover Talent
            </Button>
          </Card>
        ) : (
          savedCandidates.map((candidate) => (
            <Card
              key={candidate.id}
              className="p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-foreground text-base leading-snug">{candidate.name}</h4>
                    <p className="text-muted text-xs font-medium mt-0.5">{candidate.headline}</p>
                  </div>
                  <TrustScoreBadge score={candidate.trustScore} />
                </div>
                <p className="text-xs text-muted flex items-center gap-1.5 font-medium select-none">
                  <MapPin size={12} className="text-muted/75" />
                  {candidate.location}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1 select-none">
                  {candidate.skills.map((skill, index) => (
                    <Chip key={index} size="sm" variant="soft" className="text-[10px] font-semibold">
                      {skill}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-separator/40 pt-4">
                <Button
                  size="sm"
                  onClick={() => handleRemove(candidate.id)}
                  className="bg-default hover:bg-default/80 text-foreground font-bold text-xs px-3.5 py-1.5 rounded-xl border border-border cursor-pointer"
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
                  className="bg-accent hover:bg-accent/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border-none cursor-pointer flex items-center gap-1"
                >
                  <User size={12} /> View Profile
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
