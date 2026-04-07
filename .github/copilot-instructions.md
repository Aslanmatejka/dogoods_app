# DoGoods App - AI Coding Agent Instructions

## Project Overview

React-based community food sharing platform with Supabase backend, AI-powered matching (DeepSeek), and comprehensive admin management. Built with Vite, Tailwind CSS, React Router v6, and modern React patterns (Context API + useReducer).

**Tech Stack**: React 18.2 + Vite 5.4 + Supabase 2.39 + React Router 6.8 + Tailwind CSS 3.4 + DeepSeek AI + Recharts 3.1

**Key Dependencies**: `@supabase/supabase-js`, `react-router-dom`, `react-toastify`, `recharts`, `prop-types`

## Core Architecture Patterns

### Authentication & Authorization Flow

- **Context provider**: `AuthProvider` from [utils/AuthContext.jsx](utils/AuthContext.jsx) wraps app in [app.jsx](app.jsx)
- **Hook access**: `useAuthContext()` returns `{ user, isAuthenticated, isAdmin, loading, signIn, signUp, signOut, updateProfile, uploadAvatar }`
- **Service layer**: [utils/authService.js](utils/authService.js) manages Supabase auth + localStorage persistence + profile sync
  - On `signIn/signUp`, fetches user profile from `users` table and syncs `is_admin` flag
  - Listeners pattern: `authService.addListener()` for state changes (used by `AuthContext`)
- **Admin flag**: `is_admin` boolean column in `users` table (NOT a JWT claim in client)
- **Route protection**:
  - [AdminRoute](components/admin/AdminRoute.jsx) checks `isAdmin` from context, redirects unauthenticated to `/login?redirect=/admin` or non-admin to `/`
  - Inline `ProtectedRoute` in [app.jsx](app.jsx) for general auth (redirects to `/login`)

### State Management Pattern

- **Context + useReducer**: Example in [utils/stores/goodsStore.jsx](utils/stores/goodsStore.jsx)
  - Actions: `SET_LOADING`, `SET_ERROR`, `ADD_CLAIMED_GOOD`, `UPDATE_CLAIM_STATUS`, `REMOVE_CLAIMED_GOOD`, etc.
  - Exports: `GoodsProvider` component and `useGoods()` hook
  - Pattern: Wrap app in provider, access via hook in any child component
- **Custom hooks**: [utils/hooks/](utils/hooks/) for domain logic
  - `useAI.js`, `useClaims.js`, `useImpact.js`, `useLocation.js`, `useSupabase.js`
- **Service layer**: Class-based singletons for business logic
  - Services: `authService`, `dataService`, `feedbackService`, `impactService`, `locationService`, `urgencyService`, `verificationService`
  - Import pattern: `import authService from './utils/authService.js'` (lowercase instance)
  - All services follow singleton pattern - instantiated once at bottom of file, exported as default

### AI Integration Architecture

- **Primary API**: DeepSeek (configured in [utils/config.js](utils/config.js) with `DEEPSEEK_API_KEY`)
- **Matching engine**: [utils/MatchingEngine.js](utils/MatchingEngine.js) class
  - Circuit breaker pattern for AI failures; gracefully degrades to rule-based matching
  - Validates API key on init: checks for `sk-` prefix and non-placeholder value
- **Chat interface**: [components/assistant/AIAssistant.jsx](components/assistant/AIAssistant.jsx) (currently commented out in [MainLayout](components/layout/MainLayout.jsx))
- **Streaming**: `streamDeepseekChat()` in [utils/deepseekChat.js](utils/deepseekChat.js)
- **Rate limiting**: Configured in [utils/aiAgent.js](utils/aiAgent.js) (50 req/min default, 100 req/min premium)

## Critical Development Workflows

### First-Time Setup

```bash
# Copy config template
cp config/env.example .env.local

# Edit .env.local with your Supabase credentials:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# DEEPSEEK_API_KEY=sk-your-key (optional, for AI features)

npm install
npm run dev    # Starts Vite on port 3001, auto-opens browser
```

### Local Supabase Development (Docker Required)

```bash
npm run supabase:start    # Starts local Supabase (port 54321)
npm run supabase:studio   # Opens DB Studio at http://127.0.0.1:54323
npm run supabase:reset    # Drops DB, re-runs migrations in order
npm run dev:local         # Starts both Supabase and Vite
```

**Local URLs**: App (localhost:3001), API (127.0.0.1:54321), Studio (127.0.0.1:54323), Email testing/Inbucket (127.0.0.1:54324)

### Database Management

- **Migration files**: Located in `supabase/migrations/` (numbered sequentially)
- **Schema**: Defined via Supabase Studio or direct SQL execution
- **Key tables**: `users`, `food_listings`, `food_claims`, `community_posts`, `communities`, `sponsors`, `impact_data`, `distribution_events`, `user_feedback`, `verification_logs`
- **RLS Policies**: Row Level Security enforces `auth.uid()` checks; see [SETUP_SUPABASE.md](SETUP_SUPABASE.md) for troubleshooting
- **Admin promotion**: Manually set `is_admin = true` in `users` table via Supabase Studio SQL Editor or SQL:
  ```sql
  UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
  ```
- **MCP Server**: Model Context Protocol server in `mcp-server/` provides AI assistants direct database access
  - Configured in `.vscode/mcp.json` (requires GitHub Copilot Chat MCP enabled: Settings > "GitHub Copilot: Chat: MCP: Enabled")
  - Tools: query operations, CRUD, schema access, count records, resource browsing
  - Connected to project: `project_ref=ifzbpqyuhnxbhdcnmvfs` with features: docs, account, database, debugging, development, functions, branching, storage

### Testing & Deployment

```bash
npm test                 # Jest + React Testing Library (jsdom env)
npm run build            # Vite build → dist/
npm run preview          # Preview production build locally
./deploy.sh              # Runs tests → build → optional deploy (vercel/netlify)
```

**Deployment checklist**:

1. Set env vars on platform: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Node version: 18+ (specified in `package.json` engines)

## File Organization & Conventions

### Component Hierarchy

- **Pages** ([pages/](pages/)): Routable views matching [app.jsx](app.jsx) paths
  - Public: `HomePage.jsx`, `LoginPage.jsx`, `SignupPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`
  - Protected: `UserDashboard.jsx`, `ShareFoodPage.jsx`, `FindFoodPage.jsx`, `ProfilePage.jsx`, `CommunityPage.jsx`, `NearMePage.jsx`, `DonationSchedules.jsx`
  - Legal: `TermsOfService.jsx`, `PrivacyPolicy.jsx`, `CookiesPolicy.jsx`
  - Admin: [pages/admin/](pages/admin/) - `AdminDashboard.jsx`, `UserManagement.jsx`, `ContentModeration.jsx`, `AdminSettings.jsx`, `AdminReports.jsx`, `ImpactDataEntry.jsx`, `UserFeedback.jsx`, `VerificationManagement.jsx`, `FoodDistributionManagement.jsx`, `DistributionAttendees.jsx`, `AdminMessages.jsx`, `AdminContentManagement.jsx`
- **Components** ([components/](components/)): Domain-organized, reusable pieces
  - [layout/](components/layout/): `MainLayout.jsx` (wraps all pages), `Header.jsx`, `Footer.jsx`
  - [common/](components/common/): `ErrorBoundary.jsx`, `UserChatWidget.jsx`, `FeedbackButton.jsx`, `Tutorial.jsx`
  - [admin/](components/admin/): `AdminRoute.jsx` (auth guard), admin-specific UI
  - [food/](components/food/), [user/](components/user/), [profile/](components/profile/), [assistant/](components/assistant/), [donations/](components/donations/)

### Utilities Structure

```
utils/
├── supabaseClient.js          # Singleton Supabase instance
├── config.js                  # Runtime config (reads window.__ENV__)
├── authService.js             # Auth singleton class
├── dataService.js             # Main data fetching service (2269 lines)
├── helpers.js                 # Pure functions: formatDate(), timeAgo(), reportError()
├── MatchingEngine.js          # AI matching logic
├── deepseekChat.js            # DeepSeek streaming API client
├── AuthContext.jsx            # React Context for auth state
├── TutorialContext.jsx        # Tutorial state provider
├── stores/
│   ├── goodsStore.jsx         # Claimed/requested goods state
│   └── goodsStore.js          # (duplicate file, ignore)
├── hooks/
│   ├── useAI.js, useClaims.js, useImpact.js
│   ├── useLocation.js, useSupabase.js
└── services/
    ├── feedbackService.js, impactService.js
    ├── locationService.js, urgencyService.js
    ├── verificationService.js
    └── goodsService.js        # (empty placeholder)
```

### Configuration Cascade

1. [config/env.example](config/env.example) - Template with all vars
2. `.env.local` - Gitignored, local dev secrets (created from template)
3. [utils/config.js](utils/config.js) - Runtime loader (`window.__ENV__` → `import.meta.env` → defaults)
4. [public/config.dev.js](public/config.dev.js) / `config.production.js` - Injected via `<script>` in [index.html](index.html)

**Key vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DEEPSEEK_API_KEY`, `NODE_ENV`, `PORT`

## Integration Points & External Dependencies

### Supabase Client ([utils/supabaseClient.js](utils/supabaseClient.js))

```javascript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: { params: { eventsPerSecond: 10 } },
});
```

- **Storage buckets**: `avatars`, `food-images` (public read, user write via RLS)
- **Auth methods**: `supabase.auth.signUp()`, `signInWithPassword()`, `getSession()`, `onAuthStateChange()`
- **Data access**: `supabase.from('table_name').select().eq()...`
- **Error handling**: Supabase errors have `{ error, data }` shape; always check `error` first

### DeepSeek AI

- **Config validation**: [utils/config.js](utils/config.js) `validateApiConfig()` logs warnings if key missing/invalid
- **Usage**: [MatchingEngine.js](utils/MatchingEngine.js) calls DeepSeek API for food matching
- **Graceful degradation**: Features disable if API key validation fails
- **Fallback**: [utils/openaiClient.js](utils/openaiClient.js) exists but unused; DeepSeek is primary

### React Toastify Notifications

- **Import pattern**: `import { toast } from 'react-toastify'`
- **Usage**: `toast.success('Message')`, `toast.error('Error')`
- **Where used**: [pages/FindFoodPage.jsx](pages/FindFoodPage.jsx), [pages/admin/AdminSettings.jsx](pages/admin/AdminSettings.jsx)
- **Setup**: Configured in specific pages, NOT globally in app

## Project-Specific Patterns & Conventions

### Error Handling (Standard Across Codebase)

```javascript
import { reportError } from "./utils/helpers.js";

try {
  const result = await someOperation();
} catch (error) {
  reportError(error); // Centralized logging/reporting
  console.error("Operation failed:", error);
  // Optionally: toast.error() for user feedback
}
```

### Data Fetching Flow

1. Import service: `import dataService from './utils/dataService.js'`
2. Call async method: `const data = await dataService.getFoodClaims({ status: 'pending' })`
3. Manage loading state via Context or `useState`
4. Handle errors with `reportError()` + user notification
5. **Database-connected pages**: `HomePage` (communities), `SponsorsPage` (sponsors) fetch live data from Supabase with fallback to static data

### Styling Conventions

- **Tailwind-first**: Prefer utility classes over custom CSS
- **Glassmorphism**: `bg-white/80 backdrop-blur-md` pattern used throughout
- **Colors**: Green theme (`green-50`, `green-500`, `green-600`), gradients (`from-green-50 via-white to-green-100`)
- **Custom styles**: [styles/components.css](styles/components.css), [styles/main.css](styles/main.css)
- **Responsive**: Mobile-first (`sm:`, `md:`, `lg:`, `xl:`)

### Admin Authorization Pattern

```javascript
// In component
const { isAdmin } = useAuthContext()

if (!isAdmin) return null  // or <Navigate to="/" />

// In route
<Route path="/admin/..." element={<AdminRoute><AdminPage /></AdminRoute>} />
```

**Critical**: Admin flag is in database `users.is_admin` column, synced to context on login. NOT in JWT claims.

## Environment-Specific Behaviors

### Development Mode (`import.meta.env.MODE === 'development'`)

- Vite dev server on port 3001
- Hot module replacement (HMR)
- Console logs verbose
- Email testing via Inbucket (local Supabase)
- Source maps enabled

### Production Mode

- Static build in `dist/`
- Config loaded from [public/config.production.js](public/config.production.js)
- Console logs minimized
- Nginx serving (if using Docker)
- History API fallback for SPA routing

### Testing Environment

- Jest + jsdom (simulated browser)
- React Testing Library
- Config: [jest.config.js](jest.config.js)
- Setup: [tests/setup.js](tests/setup.js)
- Tests in [tests/](tests/) directory

## Common Pitfalls & Solutions

1. **Auth state not syncing**: Check if `AuthProvider` wraps app in [app.jsx](app.jsx); verify [utils/authService.js](utils/authService.js) `init()` called
2. **Admin routes 403**: Confirm `is_admin = true` in Supabase `users` table; check context value with DevTools
3. **Supabase RLS errors**: Policies enforce `auth.uid()`; ensure user is authenticated and owns resource
4. **AI features disabled**: Validate `DEEPSEEK_API_KEY` in [utils/config.js](utils/config.js); check console for warnings
5. **Build fails**: Ensure all env vars prefixed with `VITE_` (Vite requirement); check [vite.config.js](vite.config.js)
6. **Deployment 404s**: Configure history fallback (see [netlify.toml](netlify.toml)); verify `dist/` contains build artifacts
7. **Service import errors**: Services are lowercase default exports: `import authService from './utils/authService.js'` (NOT `import { AuthService }`)
8. **Context hook errors**: Always use hooks inside components wrapped by provider: `useAuthContext()` requires `<AuthProvider>` ancestor
