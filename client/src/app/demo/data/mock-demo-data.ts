export interface JobDescription {
  id: string;
  company: string;
  position: string;
  location: string;
  type: string;
  workMode: string;
  baseSalary: string;
  skills: string[];
  baseScore: number;
  skillsScore: number;
  finalScore: number;
  isTopMatch: boolean;
  department?: string;
  summary?: string;
  experience?: string;
}

export interface Candidate {
  id: string;
  name: string;
  initials: string;
  role: string;
  experience: string;
  trustScore: number;
  matchScore: number;
  skills: string[];
  isVerified: boolean;
  providers: ("github" | "gitlab")[];
}

export interface RankingItem {
  rank: number;
  candidateId: string;
  name: string;
  initials: string;
  matchScore: number;
  trustScore: number;
  strengthSummary: string;
  colorType: "gold" | "silver" | "bronze" | "gray";
}

// Section 05 Mock Jobs
export const SECTION05_JOBS: JobDescription[] = [
  {
    id: "job-1",
    company: "CVerify",
    position: "Principal Systems Architect",
    location: "San Francisco, CA",
    type: "Full-time",
    workMode: "Hybrid",
    baseSalary: "$190,000 - $240,000",
    skills: ["Go", "TypeScript", "Cryptography", "ZK-Proofs"],
    baseScore: 40,
    skillsScore: 78,
    finalScore: 98,
    isTopMatch: true,
  },
  {
    id: "job-2",
    company: "ZeroKnowledge Labs",
    position: "Lead Cryptography Engineer",
    location: "Austin, TX",
    type: "Full-time",
    workMode: "Remote",
    baseSalary: "$180,000 - $220,000",
    skills: ["Go", "Rust", "Cryptography", "ZK-Proofs"],
    baseScore: 35,
    skillsScore: 74,
    finalScore: 94,
    isTopMatch: false,
  },
  {
    id: "job-3",
    company: "Reactify Labs",
    position: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    workMode: "Hybrid",
    baseSalary: "$160,000 - $200,000",
    skills: ["React", "TypeScript", "TailwindCSS"],
    baseScore: 42,
    skillsScore: 68,
    finalScore: 85,
    isTopMatch: false,
  },
  {
    id: "job-4",
    company: "CloudScale Systems",
    position: "Platform / DevOps Architect",
    location: "Remote",
    type: "Full-time",
    workMode: "Remote",
    baseSalary: "$170,000 - $210,000",
    skills: ["Go", "Kubernetes", "Terraform"],
    baseScore: 30,
    skillsScore: 58,
    finalScore: 76,
    isTopMatch: false,
  },
  {
    id: "job-5",
    company: "Enterprise Core",
    position: "C# Backend Developer",
    location: "Redmond, WA",
    type: "Full-time",
    workMode: "On-site",
    baseSalary: "$150,000 - $185,000",
    skills: ["ASP.NET Core", "C#", "SQL"],
    baseScore: 28,
    skillsScore: 48,
    finalScore: 65,
    isTopMatch: false,
  },
  {
    id: "job-6",
    company: "NeuralNet AI",
    position: "AI Platform Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    workMode: "On-site",
    baseSalary: "$200,000 - $260,000",
    skills: ["Python", "PyTorch", "Go"],
    baseScore: 20,
    skillsScore: 40,
    finalScore: 52,
    isTopMatch: false,
  }
];

// Section 06 Mock Job Description (JD)
export const SECTION06_JD: JobDescription = {
  id: "sec06-job-1",
  company: "CVerify",
  position: "Principal Systems Architect",
  location: "San Francisco, CA",
  type: "Full-time",
  workMode: "Hybrid",
  baseSalary: "$190,000 - $240,000",
  skills: ["Go", "TypeScript", "Cryptography", "ZK-Proofs"],
  baseScore: 100,
  skillsScore: 100,
  finalScore: 100,
  isTopMatch: true,
  department: "Core Engineering",
  summary: "Seeking a security-focused systems architect to design robust, cryptographically-secure distributed architectures.",
  experience: "8+ Years"
};

// Section 06 AI Recommended Candidates
export const SECTION06_AI_CANDIDATES: Candidate[] = [
  {
    id: "candidate-1",
    name: "Kaivian",
    initials: "KV",
    role: "Lead Systems Engineer",
    experience: "8+ Years",
    trustScore: 99,
    matchScore: 98,
    skills: ["Go", "TypeScript", "Cryptography", "ZK-Proofs"],
    isVerified: true,
    providers: ["github"]
  },
  {
    id: "candidate-2",
    name: "Sarah Connor",
    initials: "SC",
    role: "Senior Backend Developer",
    experience: "6 Years",
    trustScore: 92,
    matchScore: 88,
    skills: ["Go", "Kubernetes", "Cryptography"],
    isVerified: true,
    providers: ["gitlab"]
  },
  {
    id: "candidate-3",
    name: "Alex Rivers",
    initials: "AR",
    role: "Systems Engineer",
    experience: "5 Years",
    trustScore: 85,
    matchScore: 76,
    skills: ["Go", "TypeScript", "Rust"],
    isVerified: true,
    providers: ["github"]
  }
];

// Section 06 Manually Applied Candidates
export const SECTION06_MANUAL_CANDIDATES: Candidate[] = [
  {
    id: "candidate-4",
    name: "David Chen",
    initials: "DC",
    role: "Full Stack Developer",
    experience: "4 Years",
    trustScore: 45,
    matchScore: 68,
    skills: ["React", "TypeScript"],
    isVerified: false,
    providers: []
  },
  {
    id: "candidate-5",
    name: "Elena Rostova",
    initials: "ER",
    role: "Backend Engineer",
    experience: "3 Years",
    trustScore: 50,
    matchScore: 62,
    skills: ["Go", "SQL"],
    isVerified: false,
    providers: []
  }
];

// Section 06 AI-Generated Rankings
export const SECTION06_RANKINGS: RankingItem[] = [
  {
    rank: 1,
    candidateId: "candidate-1",
    name: "Kaivian",
    initials: "KV",
    matchScore: 98,
    trustScore: 99,
    strengthSummary: "Perfect cryptographic expertise. Outstanding verified GitHub contribution history.",
    colorType: "gold"
  },
  {
    rank: 2,
    candidateId: "candidate-2",
    name: "Sarah Connor",
    initials: "SC",
    matchScore: 88,
    trustScore: 92,
    strengthSummary: "Strong Go and backend skills. High trust score with verified GitLab projects.",
    colorType: "silver"
  },
  {
    rank: 3,
    candidateId: "candidate-3",
    name: "Alex Rivers",
    initials: "AR",
    matchScore: 76,
    trustScore: 85,
    strengthSummary: "Competent Rust/Go experience. Good matching, but lacks advanced cryptography proofs.",
    colorType: "bronze"
  },
  {
    rank: 4,
    candidateId: "candidate-4",
    name: "David Chen",
    initials: "DC",
    matchScore: 68,
    trustScore: 45,
    strengthSummary: "Self-reported React/TypeScript. No cryptographic proof or repository links provided.",
    colorType: "gray"
  },
  {
    rank: 5,
    candidateId: "candidate-5",
    name: "Elena Rostova",
    initials: "ER",
    matchScore: 62,
    trustScore: 50,
    strengthSummary: "Junior Go programmer. No proof of contribution history.",
    colorType: "gray"
  }
];
