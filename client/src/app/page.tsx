"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileCheck2, Bot, Database, Search, ArrowRight, Check, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { PublicNavigationHeader } from '../components/ui/public-navigation-header';
import { Typography } from '@heroui/react';
import { motion } from 'framer-motion';
import Magnet from '../components/Magnet';
import SplitText from '../components/SplitText';
import SpotlightCard from '../components/SpotlightCard';
import DecryptedText from '../components/DecryptedText';
import ShinyText from '../components/ShinyText';
import NetworkBackground from '../components/NetworkBackground';
import SideRays from '../components/SideRays';
import ClickSpark from '../components/ClickSpark';

// Framer Motion Animation Presets
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut"
    }
  }
} as const;

const scaleUpVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.8,
      ease: "easeOut"
    }
  }
} as const;

export default function Home() {


  // Interactive Pipeline Simulation States
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [trustScore, setTrustScore] = useState<number>(0);

  // Auto-simulation effect
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSimulating) {
      if (activeStep < 3) {
        timer = setTimeout(() => {
          setActiveStep(prev => prev + 1);
        }, 2500);
      } else {
        requestAnimationFrame(() => setIsSimulating(false));
      }
    }
    return () => clearTimeout(timer);
  }, [isSimulating, activeStep]);

  // Scoring animation effect
  useEffect(() => {
    if (activeStep === 0) {
      requestAnimationFrame(() => setTrustScore(0));
    } else if (activeStep === 1) {
      requestAnimationFrame(() => setTrustScore(34));
    } else if (activeStep === 2) {
      requestAnimationFrame(() => setTrustScore(78));
    } else if (activeStep === 3) {
      // Animate up to final score
      let start = 78;
      const interval = setInterval(() => {
        if (start < 94) {
          start += 1;
          setTrustScore(start);
        } else {
          setTrustScore(94.2);
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [activeStep]);

  const handleStartSimulation = () => {
    setActiveStep(0);
    setTrustScore(0);
    setIsSimulating(true);
  };

  const handleResetSimulation = () => {
    setActiveStep(0);
    setTrustScore(0);
    setIsSimulating(false);
  };

  return (
    <ClickSpark sparkColor="rgba(99, 102, 241, 0.6)" sparkCount={6} sparkSize={8} duration={350} easing="ease-out">
      <style>{`
        html, body {
          scrollbar-width: none !important;
        }
        ::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>
      <div className="dark bg-background relative z-0 min-h-screen w-full text-foreground flex flex-col overflow-x-hidden selection:bg-accent/30 selection:text-foreground">
        {/* Ambient background glows for visual depth (animated to drift slowly) */}
        <motion.div
          animate={{
            x: [0, 30, -15, 0],
            y: [0, -20, 15, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[600px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.07)_0%,transparent_70%)] blur-[80px] pointer-events-none -z-10"
        />
        <motion.div
          animate={{
            x: [0, -25, 30, 0],
            y: [0, 15, -20, 0],
            scale: [1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[35%] left-[-5%] w-[50vw] h-[50vw] max-w-[500px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.05)_0%,transparent_70%)] blur-[100px] pointer-events-none -z-10"
        />
        <motion.div
          animate={{
            x: [0, 15, -30, 0],
            y: [0, -30, 10, 0],
            scale: [1, 1.08, 0.92, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[20%] right-[-5%] w-[55vw] h-[55vw] max-w-[550px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.06)_0%,transparent_70%)] blur-[90px] pointer-events-none -z-10"
        />

        {/* Subtle grid lines backdrop overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-size-[40px_40px] mask-[radial-gradient(ellipse_at_center,white_40%,transparent_90%)] pointer-events-none opacity-80" />
        {/* Subtle dot overlay for additional texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[20px_20px] mask-[radial-gradient(ellipse_at_center,white_30%,transparent_95%)] pointer-events-none opacity-70" />

        {/* Top Header Navbar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-0 left-0 right-0 z-50 w-full"
        >
          <PublicNavigationHeader className="w-full bg-transparent" forceDarkLogo />
        </motion.div>

        <main className="relative z-10 w-full flex flex-col items-center">

          {/* Section 1: Hero Section */}
          <section className="w-full pt-24 pb-20 flex flex-col items-center text-center justify-center min-h-[85vh] relative overflow-hidden">
            {/* Side Rays WebGL Background (constrained to Hero Section size to prevent stretching) */}
            <SideRays rayColor1="#EAB308" rayColor2="#96c8ff" intensity={2.0} spread={2.0} opacity={1.0} />
            <NetworkBackground />

            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="flex flex-col items-center text-center justify-center w-full max-w-4xl mx-auto px-6 z-10"
            >
              <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full text-[10px] font-mono uppercase tracking-wider bg-surface/80 border border-border/50 text-muted select-none shadow-[0_0_15px_rgba(255,255,255,0.02)] backdrop-blur-sm">
                <ShieldCheck size={12} className="text-success animate-pulse" />
                <ShinyText text="CVERIFY ENGINE v2" speed={3} color="var(--muted)" shineColor="#ffffff" />
              </motion.div>

              <motion.div variants={itemVariants} className="h-[140px] sm:h-[180px] flex items-center justify-center mb-6">
                <SplitText
                  text="Hiring based on proof, not claims."
                  className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] text-foreground justify-center text-center"
                  delay={45}
                  duration={1.2}
                  ease="power3.out"
                  splitType="words"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <Typography type="body-sm" className="max-w-xl text-muted text-base sm:text-lg leading-relaxed font-light mb-10 select-none">
                  CVerify parses Git metadata and AST patterns to generate mathematically proven, high-trust developer profiles.
                </Typography>
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 select-none w-full max-w-md justify-center items-center">
                <Magnet padding={30} disabled={false} magnetStrength={30}>
                  <Link href="/login" className="w-full sm:w-auto block">
                    <button className="w-full sm:w-[240px] h-12 rounded-xl text-xs font-semibold bg-foreground text-background hover:bg-foreground/95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.15)] border border-border/25 cursor-pointer group">
                      Generate Verified Profile
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
                    </button>
                  </Link>
                </Magnet>
                <button
                  onClick={() => {
                    const element = document.getElementById("trust-showcase");
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                      setTimeout(handleStartSimulation, 800);
                    }
                  }}
                  className="w-full sm:w-[200px] h-12 rounded-xl text-xs font-semibold bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-all border border-border/40 text-foreground backdrop-blur-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  View Verification Demo
                </button>
              </motion.div>
            </motion.div>
          </section>

          {/* Section 2: Integrations/Trust Wall */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={scaleUpVariants}
            className="w-full border-y border-border/10 py-8 bg-black/35 backdrop-blur-sm relative"
          >
            <div className="absolute inset-0 bg-linear-to-r from-background via-transparent to-background pointer-events-none z-10" />
            <div className="max-w-5xl mx-auto px-6 flex flex-col items-center justify-center gap-4 relative z-20">
              <span className="text-[10px] font-mono tracking-widest text-muted uppercase">Verified Integrations</span>
              <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-45 grayscale hover:grayscale-0 transition-all duration-500">
                <svg className="h-5 w-auto fill-foreground" viewBox="0 0 24 24" aria-label="GitHub">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                <svg className="h-5 w-auto fill-foreground" viewBox="0 0 24 24" aria-label="GitLab">
                  <path d="M23.953 13.072l-1.643-5.053L20.443 2.34c-.16-.49-.853-.49-1.013 0l-1.867 5.679H6.437l-1.867-5.679c-.16-.49-.853-.49-1.013 0L1.69 8.019.047 13.072c-.12.37.013.78.333 1.013l11.62 8.441 11.62-8.441c.32-.233.453-.643.333-1.013z" />
                </svg>
                <svg className="h-5 w-auto fill-foreground" viewBox="0 0 24 24" aria-label="Bitbucket">
                  <path d="M22.3 3h-20.6c-.9 0-1.7.7-1.7 1.6v14.8c0 .9.7 1.6 1.7 1.6h20.6c.9 0 1.7-.7 1.7-1.6v-14.8c0-.9-.7-1.6-1.7-1.6zm-5.7 12.7h-9.2l-1.4-6.4h12l-1.4 6.4z" />
                </svg>
                <svg className="h-5 w-auto fill-foreground" viewBox="0 0 24 24" aria-label="Azure DevOps">
                  <path d="M0 8.522l3.478-3.478 6.522 6.522-6.522 6.522zm10.435-3.478l10.087 10.087-3.13 3.13-10.087-10.087zm3.13 13.565l6.957-6.957 3.478 3.478-6.957 6.957zm6.957-6.957l3.478-3.478v6.956z" />
                </svg>
              </div>
            </div>
          </motion.section>

          {/* Section 3: The Unified Trust System (Interactive Showcase - Single Truth Layer) */}
          <motion.section
            id="trust-showcase"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="w-full py-28 relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.035)_0%,transparent_70%)] border-b border-border/5"
          >
            <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center relative z-10">
              <motion.div variants={itemVariants} className="text-center mb-16 space-y-4">
                <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/80">
                  The Unified Trust Engine
                </h2>
                <Typography type="body-sm" className="text-muted max-w-xl mx-auto font-light leading-relaxed">
                  Verify how CVerify ingests codebase signatures, runs automated complexity scoring, and issues verified credentials.
                </Typography>
              </motion.div>

              <motion.div variants={itemVariants} className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* Left Column: Interactive Terminal */}
                <div className="lg:col-span-7 flex flex-col">
                  <SpotlightCard className="h-full flex flex-col bg-surface/90 border border-border/40 p-6 rounded-2xl relative shadow-xl backdrop-blur-sm" spotlightColor="rgba(99, 102, 241, 0.08)">
                    <div className="flex items-center justify-between border-b border-border/15 pb-4 mb-4 select-none">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-danger/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
                        <span className="font-mono text-[10px] text-muted ml-2">cverify-pipeline-daemon</span>
                      </div>
                      <div className="flex gap-1.5 font-mono text-[9px] text-muted">
                        <span className={`px-2 py-0.5 rounded transition-all duration-300 ${activeStep === 0 ? 'bg-foreground/10 text-foreground font-semibold' : ''}`}>01_INGEST</span>
                        <span className={`px-2 py-0.5 rounded transition-all duration-300 ${activeStep === 1 ? 'bg-foreground/10 text-foreground font-semibold' : ''}`}>02_AST</span>
                        <span className={`px-2 py-0.5 rounded transition-all duration-300 ${activeStep === 2 ? 'bg-foreground/10 text-foreground font-semibold' : ''}`}>03_SCORE</span>
                        <span className={`px-2 py-0.5 rounded transition-all duration-300 ${activeStep === 3 ? 'bg-foreground/10 text-foreground font-semibold' : ''}`}>04_SIGN</span>
                      </div>
                    </div>

                    {/* Simulated Log Output Screen */}
                    <div className="flex-1 font-mono text-[11px] text-muted/90 space-y-2.5 bg-black/45 border border-border/10 rounded-lg p-4 min-h-[220px] overflow-y-auto text-left leading-relaxed shadow-inner">
                      {activeStep >= 0 && (
                        <div className="space-y-1">
                          <p className="text-muted/60">[00:01] INGESTION ENGINE START</p>
                          <p className="text-foreground flex items-center gap-1.5">
                            <span className="text-success">✔</span> Connected to github.com/ariver-dev/kernel-net
                          </p>
                          <p className="text-foreground">↳ Scanning git indices: found 482 commits across 3 branches.</p>
                          <p className="text-foreground">↳ Verifying signature matching: GPG Key <span className="text-accent text-neutral font-semibold">0x8f2a...4b1c</span> matches authorized profile.</p>
                        </div>
                      )}

                      {activeStep >= 1 && (
                        <div className="space-y-1 border-t border-border/10 pt-2.5">
                          <p className="text-muted/60">[00:24] AST PARSING MODULE</p>
                          <p className="text-foreground flex items-center gap-1.5">
                            <span className="text-success">✔</span> Ingestion verified. Abstract Syntax Tree parsing active.
                          </p>
                          <p className="text-foreground">↳ Analyzing language signatures: TypeScript (82%), Rust (18%).</p>
                          <p className="text-foreground flex items-center gap-1">
                            ↳ Complexity analysis: AST depth resolved. Complexity Coefficient:
                            <span className="text-success font-semibold">0.88</span>
                          </p>
                        </div>
                      )}

                      {activeStep >= 2 && (
                        <div className="space-y-1 border-t border-border/10 pt-2.5">
                          <p className="text-muted/60">[01:10] TRUST WEIGHT SCORING</p>
                          <p className="text-foreground flex items-center gap-1.5">
                            <span className="text-success">✔</span> Running multi-dimensional scoring algorithms.
                          </p>
                          <p className="text-foreground">↳ Checking anti-tampering parameters (timeline consistency)... [PASSED]</p>
                          <p className="text-foreground">↳ Ownership metrics validated: 99.2% verified authorship matches.</p>
                        </div>
                      )}

                      {activeStep >= 3 && (
                        <div className="space-y-1 border-t border-border/10 pt-2.5">
                          <p className="text-muted/60">[01:45] CRYPTOGRAPHIC SIGNING & OUTPUT</p>
                          <p className="text-foreground flex items-center gap-1.5">
                            <span className="text-success">✔</span> Computations completed. Output profile sealed.
                          </p>
                          <p className="text-foreground flex items-center gap-1">
                            ↳ GPG Hash:
                            <DecryptedText text="SHA256:9e8767dbabf0981e86da188704152b9edab60b56" animateOn="view" speed={35} className="font-semibold text-accent text-neutral" />
                          </p>
                          <p className="text-success font-semibold flex items-center gap-1.5 mt-1 animate-pulse">
                            ● VERIFICATION PIPELINE STATUS: SEALED & LOCKED
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Control Action Buttons */}
                    <div className="flex gap-3 mt-4 justify-start items-center">
                      <Link href="/demo">
                        <button className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/90 text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm">
                          Interactive Demo
                        </button>
                      </Link>
                      {!isSimulating && activeStep === 0 ? (
                        <button
                          onClick={handleStartSimulation}
                          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                          <RefreshCw size={12} className="animate-spin-slow" /> Run Verification Pipeline
                        </button>
                      ) : (
                        <button
                          onClick={handleResetSimulation}
                          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-surface-secondary text-foreground hover:bg-surface-secondary/80 transition-all flex items-center gap-2 cursor-pointer border border-border/40"
                        >
                          Reset Simulation
                        </button>
                      )}
                    </div>
                  </SpotlightCard>
                </div>

                {/* Right Column: Live Output Profile Card */}
                <div className="lg:col-span-5 flex flex-col">
                  <SpotlightCard className="h-full bg-surface/90 border border-border/40 p-6 rounded-2xl flex flex-col relative justify-between shadow-xl backdrop-blur-sm" spotlightColor="rgba(16, 185, 129, 0.08)">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-3 items-center">
                          <div className="size-10 rounded-full bg-surface-secondary border border-border/40 flex items-center justify-center font-bold text-sm text-foreground select-none">
                            AR
                          </div>
                          <div className="text-left">
                            <h3 className="font-bold text-foreground text-sm">Alex River</h3>
                            <p className="text-[10px] text-muted font-mono uppercase tracking-wider">Systems Engineer</p>
                          </div>
                        </div>
                        {activeStep === 3 ? (
                          <div className="px-2 py-0.5 rounded border border-success/30 bg-success/10 text-success font-mono text-[9px] uppercase font-bold animate-pulse select-none">
                            Verified
                          </div>
                        ) : (
                          <div className="px-2 py-0.5 rounded border border-border/50 bg-surface-secondary/40 text-muted font-mono text-[9px] uppercase select-none">
                            Pending
                          </div>
                        )}
                      </div>

                      {/* Trust Score circular graphic representation */}
                      <div className="flex flex-col items-center py-6 select-none border-y border-border/10 mb-6">
                        <div className="relative size-28 flex items-center justify-center">
                          {/* Animated outer border based on step progress */}
                          <svg className="absolute inset-0 size-full -rotate-90">
                            <circle
                              cx="56"
                              cy="56"
                              r="50"
                              className="stroke-border/20 fill-none"
                              strokeWidth="4"
                            />
                            <circle
                              cx="56"
                              cy="56"
                              r="50"
                              className={`transition-all duration-500 fill-none ${activeStep === 3 ? 'stroke-success drop-shadow-[0_0_8px_rgba(22,156,70,0.4)]' : 'stroke-foreground'
                                }`}
                              strokeWidth="4"
                              strokeDasharray="314"
                              strokeDashoffset={314 - (314 * Math.min(trustScore, 100)) / 100}
                            />
                          </svg>
                          <div className="flex flex-col items-center">
                            <span className={`text-2xl font-extrabold tracking-tight font-mono transition-colors duration-500 ${activeStep === 3 ? 'text-success' : 'text-foreground'}`}>
                              {trustScore}
                            </span>
                            <span className="text-[8px] font-mono tracking-widest text-muted uppercase">Trust Index</span>
                          </div>
                        </div>
                      </div>

                      {/* Computed Metrics List */}
                      <div className="space-y-3.5 text-left text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted">Commit Ingest Integrity</span>
                          <span className={`font-mono font-semibold transition-colors duration-300 ${activeStep >= 2 ? 'text-foreground' : 'text-muted/40'}`}>
                            {activeStep >= 2 ? '99.2%' : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted">Complexity Rank (AST)</span>
                          <span className={`font-mono font-semibold transition-colors duration-300 ${activeStep >= 1 ? 'text-foreground' : 'text-muted/40'}`}>
                            {activeStep >= 1 ? '0.88' : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted">Primary Language footprint</span>
                          <span className={`font-semibold transition-colors duration-300 ${activeStep >= 1 ? 'text-foreground' : 'text-muted/40'}`}>
                            {activeStep >= 1 ? 'TypeScript' : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border/10 pt-4 mt-6 flex justify-between items-center select-none">
                      <span className="font-mono text-[9px] text-muted">SIGNATURE: 0x8f2a...4b1c</span>
                      <ShieldCheck size={16} className={`transition-all duration-500 ${activeStep === 3 ? 'text-success drop-shadow-[0_0_4px_rgba(22,156,70,0.3)]' : 'text-muted/30'}`} />
                    </div>
                  </SpotlightCard>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* Section 4: Deep Dive into the Three Pillars */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="w-full py-24 border-y border-border/5 bg-linear-to-b from-transparent via-surface-secondary/5 to-transparent relative overflow-hidden"
          >
            <div className="w-full max-w-7xl mx-auto px-6 flex flex-col items-center relative z-10">
              <motion.div variants={itemVariants} className="text-center mb-16 space-y-4">
                <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/80">
                  Built on Three Architecture Pillars
                </h2>
                <Typography type="body-sm" className="text-muted max-w-xl mx-auto font-light leading-relaxed">
                  Understand the core layers engineered to guarantee trust without requiring manual checks.
                </Typography>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Pillar 1: Evidence Engine */}
                <motion.div variants={itemVariants}>
                  <SpotlightCard className="h-full bg-surface/90 border border-border/40 p-8 rounded-2xl text-left shadow-lg" spotlightColor="rgba(6, 182, 212, 0.08)">
                    <div className="size-10 rounded-lg bg-surface-secondary text-foreground flex items-center justify-center mb-6 border border-border/40 select-none shadow-sm">
                      <Database size={20} />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-3">
                      1. The Evidence Engine
                    </h3>
                    <p className="text-xs text-muted leading-relaxed font-light">
                      Securely reads Git trees, confirming identity metadata and validating cryptographic signatures across complete timelines.
                    </p>
                  </SpotlightCard>
                </motion.div>

                {/* Pillar 2: Trust Scoring */}
                <motion.div variants={itemVariants}>
                  <SpotlightCard className="h-full bg-surface/90 border border-border/40 p-8 rounded-2xl text-left shadow-lg" spotlightColor="rgba(99, 102, 241, 0.08)">
                    <div className="size-10 rounded-lg bg-surface-secondary text-foreground flex items-center justify-center mb-6 border border-border/40 select-none shadow-sm">
                      <Search size={20} />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-3">
                      2. Automated Scoring
                    </h3>
                    <p className="text-xs text-muted leading-relaxed font-light">
                      Analyzes AST nodes to check structural codebase complexity, evaluating authorship depth and consistency indicators.
                    </p>
                  </SpotlightCard>
                </motion.div>

                {/* Pillar 3: Verified Output Layer */}
                <motion.div variants={itemVariants}>
                  <SpotlightCard className="h-full bg-surface/90 border border-border/40 p-8 rounded-2xl text-left shadow-lg" spotlightColor="rgba(16, 185, 129, 0.08)">
                    <div className="size-10 rounded-lg bg-surface-secondary text-foreground flex items-center justify-center mb-6 border border-border/40 select-none shadow-sm">
                      <FileCheck2 size={20} />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-3">
                      3. Signed Output Layer
                    </h3>
                    <p className="text-xs text-muted leading-relaxed font-light">
                      Generates signed developer profiles and machine-readable JSON logs sealed with cryptographic validation hashes.
                    </p>
                  </SpotlightCard>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* Section 5: Evidence-Based vs. Self-Declared Comparison */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="w-full py-24 bg-linear-to-br from-black/25 via-[#0c0c0f] to-black/25 relative overflow-hidden"
          >
            <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center relative z-10">
              <motion.div variants={itemVariants} className="text-center mb-16 space-y-4">
                <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/80">
                  A Shift in Engineering Hiring
                </h2>
                <Typography type="body-sm" className="text-muted max-w-xl mx-auto font-light leading-relaxed">
                  Why leading engineering teams choose validated history over unverified resumes.
                </Typography>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch select-none">
                {/* Self-Declared Card */}
                <motion.div variants={itemVariants} className="bg-surface/80 border border-border/30 rounded-2xl p-6 flex flex-col justify-between shadow-md backdrop-blur-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-6 text-muted">
                      <X size={16} className="text-danger" />
                      <span className="font-mono text-[10px] tracking-wider uppercase font-semibold">Traditional Resumes</span>
                    </div>
                    <ul className="space-y-4 text-xs text-muted text-left">
                      <li className="flex gap-3 items-start opacity-70">
                        <span className="text-danger shrink-0 mt-0.5">▪</span>
                        <span>Self-declared skill assessments that cannot be parsed or validated.</span>
                      </li>
                      <li className="flex gap-3 items-start opacity-70">
                        <span className="text-danger shrink-0 mt-0.5">▪</span>
                        <span>Timeline claims requiring hours of human review to check.</span>
                      </li>
                      <li className="flex gap-3 items-start opacity-70">
                        <span className="text-danger shrink-0 mt-0.5">▪</span>
                        <span>Padded keyword descriptions lacking core codebase proof.</span>
                      </li>
                    </ul>
                  </div>
                </motion.div>

                {/* Evidence-Based Card */}
                <motion.div variants={itemVariants} className="bg-surface/80 border border-success/30 rounded-2xl p-6 flex flex-col justify-between shadow-[0_8px_30px_rgba(22,156,70,0.03)] backdrop-blur-sm relative overflow-hidden group hover:border-success/50 transition-all duration-300">
                  <div className="absolute top-0 right-0 size-32 bg-[radial-gradient(circle,rgba(22,156,70,0.05)_0%,transparent_70%)] blur-[25px] pointer-events-none" />
                  <div>
                    <div className="flex items-center gap-2 mb-6 text-success">
                      <Check size={16} className="animate-pulse" />
                      <span className="font-mono text-[10px] tracking-wider uppercase font-semibold">CVerify Credentials</span>
                    </div>
                    <ul className="space-y-4 text-xs text-muted text-left">
                      <li className="flex gap-3 items-start">
                        <span className="text-success shrink-0 mt-0.5">▪</span>
                        <span className="text-foreground">AST-validated metrics showing active contribution depth.</span>
                      </li>
                      <li className="flex gap-3 items-start">
                        <span className="text-success shrink-0 mt-0.5">▪</span>
                        <span className="text-foreground">Cryptographically validated activity history using GPG signature keys.</span>
                      </li>
                      <li className="flex gap-3 items-start">
                        <span className="text-success shrink-0 mt-0.5">▪</span>
                        <span className="text-foreground">Tamper-proof profiles locked to verified repository records.</span>
                      </li>
                    </ul>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* Section 6: Final CTA Section */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="w-full max-w-4xl mx-auto px-6 py-28 text-center flex flex-col items-center"
          >
            <motion.div variants={itemVariants} className="w-full bg-surface/90 border border-border/40 rounded-3xl p-12 relative overflow-hidden flex flex-col items-center shadow-2xl backdrop-blur-sm">
              <NetworkBackground />

              {/* Ambient inner gradient glow */}
              <div className="absolute bottom-[-20%] left-[50%] -translate-x-1/2 w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)] blur-[60px] pointer-events-none" />

              {/* Subtle background visual overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-size-[16px_16px] pointer-events-none" />

              <div className="relative z-10 space-y-6 max-w-xl flex flex-col items-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider bg-surface-secondary/40 border border-border/30 text-muted select-none">
                  <Bot size={11} className="text-accent animate-pulse" />
                  Deploy Engine
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/85">
                  Verify your talent pipeline today.
                </h2>
                <Typography type="body-sm" className="text-muted text-sm leading-relaxed font-light mb-4 max-w-sm">
                  Scale your engineering validation with mathematical confidence. Connect your platforms.
                </Typography>
                <div className="select-none pt-2 flex flex-col sm:flex-row gap-4 items-center justify-center">
                  <Magnet padding={30} disabled={false} magnetStrength={30}>
                    <Link href="/login" className="inline-block">
                      <button className="px-6 h-12 rounded-xl text-xs font-semibold bg-foreground text-background hover:bg-foreground/95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.15)] border border-border/25 cursor-pointer">
                        Generate Verified Profile
                        <ArrowRight size={14} />
                      </button>
                    </Link>
                  </Magnet>
                  <Link href="/demo" className="inline-block">
                    <button className="px-6 h-12 rounded-xl text-xs font-semibold bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-all border border-border/40 text-foreground backdrop-blur-sm flex items-center justify-center gap-2 cursor-pointer">
                      Try Interactive Demo
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.section>

        </main>

        {/* Minimalist footer */}
        <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 border-t border-border/15 text-center text-xs text-muted/50 select-none flex flex-col md:flex-row justify-between items-center gap-4">
          <Typography type="body-xs" className="text-muted/50">
            CVERIFY © 2026. REAL COMMITS. REAL CAREER
          </Typography>
          <div className="flex gap-4 md:gap-6">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/status" className="hover:text-foreground transition-colors">System Status</Link>
          </div>
        </footer>
      </div>
    </ClickSpark>
  );
}

