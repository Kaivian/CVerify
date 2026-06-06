---
trigger: model_decision
description: Apply when creating, renaming, refactoring, or reviewing files, folders, classes, interfaces, methods, variables, components, hooks, DTOs, APIs, and database entities. Names must prioritize business intent, clarity, and consistency.
---

# Naming Rules

## Core Philosophy

Names should describe business intent, not implementation details, visual appearance, or temporary behavior.

A developer should understand the purpose of a file, class, method, component, or variable without opening its implementation.

Prefer:

```text
RepositorySyncService
TrustScoreCalculator
RepositoryOwnershipBadge
```

Over:

```text
DataProcessor
Helper
Manager
BlueBadge
```

Names are part of the architecture and should be treated as documentation.

---

## General Rules

Names should be:

- Clear
- Specific
- Consistent
- Business-oriented
- Self-explanatory

Avoid:

- Generic names
- Unclear abbreviations
- Technical placeholders
- Temporary naming

Bad examples:

```text
Data
Info
Item
Object
Temp
Manager
Helper
Processor
Utils
Handler
ServiceImpl
```

Use descriptive names instead.

---

## Business Intent First

Prefer names that explain why something exists rather than how it works.

Good:

```text
RepositoryVerificationService
TrustScoreCalculationJob
GithubAccountConnection
```

Bad:

```text
DataProcessor
VerificationHandler
GithubManager
```

Business meaning always takes priority over implementation details.

---

# Frontend Naming Rules

## Components

Use PascalCase.

Component names should describe business purpose rather than visual appearance.

Good:

```tsx
RepositoryCard
LinkedAccountCard
VerificationStatusBadge
TrustScoreOverview
```

Bad:

```tsx
BlueCard
InfoBox
MainContainer
LargePanel
```

A component should be named after what it represents, not how it looks.

---

## Page Components

Pages should reflect feature intent.

Good:

```tsx
RepositoryManagementPage
AccountSecurityPage
```

Bad:

```tsx
MainPage
DashboardView
ContentPage
```

---

## Hooks

Custom hooks must start with:

```tsx
use
```

Examples:

```tsx
useRepositories
useLinkedAccounts
useTrustScore
```

Avoid:

```tsx
repositoryHook
getRepositoriesHook
repositoryManager
```

---

## State Variables

State names should clearly represent their contents.

Good:

```tsx
isLoading
isSyncing
selectedRepository
filteredRepositories
searchQuery
```

Bad:

```tsx
data
list
temp
item
obj
state
```

---

## Event Handlers

Use:

```tsx
handle<Action>
```

Examples:

```tsx
handleSubmit
handleRepositorySync
handleProviderDisconnect
```

Avoid:

```tsx
doStuff
onClickHandler
runAction
```

---

## Utility Functions

Utility functions should describe their outcome.

Good:

```tsx
calculateTrustScore
formatRepositoryName
buildRepositoryUrl
```

Bad:

```tsx
processData
handleData
executeLogic
```

---

## CSS and Styling

Avoid class names tied to colors or temporary styling decisions.

Good:

```text
verification-badge
repository-card
account-status
```

Bad:

```text
blue-card
green-button
red-box
```

Names should remain valid even if the design changes.

---

# Backend Naming Rules

## Classes

Use PascalCase.

Class names should describe responsibility.

Good:

```csharp
RepositorySyncService
TrustScoreService
VerificationService
```

Bad:

```csharp
DataManager
UtilityClass
HelperService
```

---

## Interfaces

Use:

```csharp
I<ServiceName>
```

Examples:

```csharp
IRepositoryService
ITrustScoreService
IVerificationService
```

Avoid:

```csharp
IDataManager
IProcessor
IHelper
```

---

## Services

Service names should reflect business capabilities.

Good:

```csharp
RepositoryVerificationService
GithubIntegrationService
TrustScoreCalculationService
```

Bad:

```csharp
Manager
Processor
Helper
Executor
```

---

## Repositories

Repository names should clearly identify the aggregate or entity they manage.

Good:

```csharp
IUserRepository
IRepositoryRepository
ITrustScoreRepository
```

Avoid:

```csharp
IDataRepository
IGenericRepository
```

unless a generic repository pattern already exists in the project.

---

## DTOs

DTO names should reflect direction and purpose.

Examples:

```csharp
CreateRepositoryRequest
UpdateProfileRequest
RepositoryResponse
UserSummaryResponse
```

Avoid:

```csharp
RepositoryDto
UserModel
DataObject
```

when a more descriptive name is possible.

---

## Methods

Method names should describe behavior and outcome.

Good:

```csharp
SyncRepositoriesAsync
VerifyOwnershipAsync
CalculateTrustScoreAsync
```

Bad:

```csharp
Process
Handle
Run
Execute
DoWork
```

---

## Variables

Variables should clearly communicate meaning.

Good:

```csharp
repositoryCount
linkedAccounts
verificationResult
calculatedScore
```

Bad:

```csharp
data
result
obj
temp
value
```

except when the scope is extremely small and obvious.

---

## Booleans

Boolean names should read naturally.

Good:

```csharp
isVerified
isActive
hasAccess
canEdit
```

Bad:

```csharp
verified
access
edit
flag
status
```

---

## Files and Folders

Folder names should describe business domains or architectural responsibilities.

Good:

```text
repositories
verification
trust-scoring
linked-accounts
```

Bad:

```text
misc
common2
helpers
new-folder
temp
```

Avoid creating folders that do not communicate clear intent.

---

## Consistency Rules

If a naming pattern already exists in the codebase:

- Follow the existing pattern.
- Do not introduce alternative naming styles.
- Do not rename unrelated code solely for preference.

Consistency is more important than personal naming preference.

---

## AI-Specific Requirements

Before creating any new name:

1. Search for similar names in the existing codebase.
2. Follow established naming conventions.
3. Prefer business terminology already used by the project.
4. Avoid introducing synonyms for existing concepts.

Example:

If the project already uses:

```text
Repository
```

Do not introduce:

```text
ProjectRepository
CodeRepository
SourceRepository
```

for the same concept.

Use one canonical term throughout the codebase.

Names should make the codebase feel like it was written by a single team using a shared vocabulary.