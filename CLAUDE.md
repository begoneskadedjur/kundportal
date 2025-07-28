# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **BeGone Kundportal**, a comprehensive pest control management system built with React + TypeScript + Vite. The application serves multiple user roles:
- **Admin**: Full system access for management
- **Koordinator**: Coordinator role for scheduling and case management  
- **Technician**: Field technicians accessing their cases and commissions
- **Customer**: Client portal for viewing cases and schedules

## Tech Stack & Dependencies

- **Frontend**: React 19.1, TypeScript, Vite
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **UI**: TailwindCSS 4.1 with custom dark theme
- **Calendar**: FullCalendar with multiple views (daygrid, timegrid, resource timeline)
- **External APIs**: ClickUp (task management), Oneflow (contracts), OpenAI (AI analysis), Abax (vehicles)
- **Charts**: Recharts for analytics dashboards
- **Forms**: react-datepicker, react-hot-toast for notifications
- **PDF**: jsPDF for report generation
- **Email**: Nodemailer for customer communications

## Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production  
npm run build

# Type checking (run before commits)
npm run type-check

# Linting (run before commits)
npm run lint

# Preview production build
npm run preview
```

## Key Architecture Components

### Authentication & Authorization
- Supabase auth with role-based access control via `AuthContext`
- `ProtectedRoute` component enforces role permissions
- User roles: `admin`, `koordinator`, `technician`, `customer`
- Profile management links users to customers or technicians

### Database Schema (Supabase)
- **customers**: Contract customers with billing information
- **technicians**: Field workers with work schedules and vehicle assignments  
- **cases**: Legacy customer cases
- **private_cases**: Individual customer cases from ClickUp
- **business_cases**: Business customer cases from ClickUp
- **profiles**: User authentication and role management
- **billing_audit_log**: Tracks billing status changes

### State Management
- React Context for authentication (`AuthContext`)
- Custom hooks for complex data operations:
  - `useCommissionDashboard`: Technician commission calculations
  - `useEconomicsDashboard`: Financial analytics
  - `useTechnicianDashboard`: Performance metrics

### External Integrations
- **ClickUp API**: Task synchronization and field mapping
- **Oneflow**: Contract generation and management
- **Abax**: Vehicle tracking for technicians
- **OpenAI**: AI-powered technician performance analysis

## File Structure

```
src/
├── components/
│   ├── admin/           # Admin-only components
│   ├── coordinator/     # Coordinator scheduling components  
│   ├── customer/        # Customer portal components
│   ├── shared/          # Reusable components
│   └── ui/              # Base UI components
├── pages/               # Route components organized by role
├── services/            # API clients and business logic
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
├── utils/               # Helper functions
└── lib/                 # Configuration (Supabase, etc.)

api/                     # Vercel serverless functions
```

### Critical Type Definitions
- `src/types/database.ts`: Complete Supabase schema with status mappings
- `src/types/commission.ts`: Commission calculation types
- `src/types/billing.ts`: Billing and audit types

## Important Business Logic

### ClickUp Status Integration
The system uses a comprehensive status mapping system defined in `database.ts`:
- Status IDs map to Swedish status names
- Color coding and workflow types are maintained
- `isCompletedStatus()` determines case completion

### Commission Calculations  
Technician commissions are calculated based on:
- Case completion status
- Price field from ClickUp custom fields
- Billing status (pending/sent/paid/skip)
- Monthly aggregation with export functionality

### Work Schedule Management
Technicians have configurable work schedules:
- JSON-based weekly schedule in database
- Validation for working hours and limits
- Integration with scheduling components

## Development Guidelines

### Database Operations
- Always use typed Supabase client from `src/lib/supabase.ts`
- Real-time subscriptions are set up for live updates
- Use row-level security policies for data access control

### ClickUp Integration
- Field mappings are defined in `src/utils/clickupFieldMapper.ts`
- Custom fields vary between private and business cases
- Status synchronization maintains data consistency

### Error Handling
- Use react-hot-toast for user notifications
- Implement proper loading states for async operations
- Handle Supabase errors gracefully with user-friendly messages

### Styling Conventions
- Dark theme with slate color palette
- Consistent spacing using Tailwind utilities
- Responsive design with mobile-first approach
- Custom CSS for FullCalendar integration in `src/styles/FullCalendar.css`

## Deployment

- Deployed on Vercel with serverless functions
- Build command: `npm run build`
- Environment variables required for Supabase and external APIs
- Static files served from `dist/` directory after build