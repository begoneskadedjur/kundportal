# Enhanced UI Components för BeGone Kundportal

Detta bibliotek innehåller återanvändbara UI-komponenter med professionella animationer och interaktivitet som kan användas överallt i BeGone systemet.

## 🎯 Översikt

Dessa komponenter är byggda för att ge en enhetlig och imponerande användarupplevelse med:
- Smooth animationer med Framer Motion
- Interactive hover states och micro-interactions  
- Professional loading states
- Real-time data visualization
- Accessibility-first design
- TypeScript för type safety

## 📦 Komponenter

### `<EnhancedKpiCard />`
En förbättrad KPI-kort komponent med animerade siffror, trend indicators och optional chart support.

```tsx
<EnhancedKpiCard
  title="Total Intäkt"
  value={125000}
  icon={DollarSign}
  onClick={() => console.log('Clicked')}
  trend="up"
  trendValue="+12%"
  prefix=""
  suffix=" kr"
  decimals={0}
  delay={0.1}
  revenueBreakdown={{
    contracts: 80000,
    privateCases: 25000,
    businessCases: 15000,
    legacyCases: 5000
  }}
/>
```

**Props:**
- `title`: string - KPI titel
- `value`: number | string - Huvudvärde att visa
- `icon`: React.ElementType - Lucide icon komponent
- `onClick?`: () => void - Click handler för interaktivitet
- `trend?`: 'up' | 'down' | 'neutral' - Trend riktning
- `trendValue?`: string - Trend procent eller värde
- `delay?`: number - Animation delay i sekunder
- `revenueBreakdown?`: RevenueData - För att visa mini pie chart

### `<AnimatedNumber />`
Räkna upp animationer för numeriska värden.

```tsx
<AnimatedNumber
  value={1250}
  duration={2}
  prefix="$"
  suffix=" kr"
  decimals={0}
/>
```

### `<TrendIndicator />`
Visar trend med ikon, procent och optional sparkline chart.

```tsx
<TrendIndicator
  trend="up"
  percentage="+15%"
  data={[{value: 100}, {value: 120}, {value: 150}]}
  showChart={true}
  showIcon={true}
/>
```

### `<EnhancedSkeleton />`
Professional loading skeletons för olika content types.

```tsx
// KPI card skeleton
<EnhancedSkeleton variant="kpi" count={4} />

// Navigation card skeleton  
<EnhancedSkeleton variant="card" count={8} />

// Timeline skeleton
<EnhancedSkeleton variant="timeline" count={3} />
```

**Variants:**
- `kpi` - KPI card skeleton med icon och värde
- `card` - Navigation card med icon, titel och beskrivning
- `timeline` - Timeline entry med dot och content
- `text` - Basic text line
- `circle` - Circular placeholder
- `rectangle` - Rectangular placeholder

### `<QuickActionBar />`
Command palette med keyboard shortcuts för snabb navigation.

```tsx
<QuickActionBar className="mb-8" />
```

**Features:**
- Command palette med ⌘K / Ctrl+K
- Kategoriserade actions (Navigation, Create, Manage)
- Fuzzy search genom alla funktioner
- Keyboard navigation
- Custom action buttons för vanliga tasks

### `<StaggeredGrid />`
Container för staggered animations av child elements.

```tsx
<StaggeredGrid 
  className="grid grid-cols-4 gap-6"
  staggerDelay={0.1}
  initialDelay={0.5}
>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</StaggeredGrid>
```

### `<InteractiveRevenueChart />`
Mini pie chart för revenue breakdown med interaktiva hover effects.

```tsx
<InteractiveRevenueChart
  data={{
    contracts: 80000,
    privateCases: 25000,
    businessCases: 15000,
    legacyCases: 5000
  }}
  size={120}
/>
```

### `<VisualTimeline />`
Visual timeline för activity feeds med categorized icons och animations.

```tsx
<VisualTimeline
  activities={[
    {
      id: '1',
      type: 'system',
      title: 'System uppdaterat',
      description: 'Dashboard laddat med senaste data',
      timestamp: 'Nu',
      user: 'System'
    }
  ]}
  maxItems={5}
/>
```

**Activity Types:**
- `system` - System events (blue)
- `user` - User actions (green)  
- `billing` - Billing events (yellow)
- `update` - Updates (purple)
- `success` - Success states (green)
- `warning` - Warnings (orange)
- `info` - Information (slate)

### `<LiveStatusIndicator />`
Real-time status indicator för services med animated dots.

```tsx
<LiveStatusIndicator
  services={[
    {
      name: 'Database',
      status: 'online',
      responseTime: '< 50ms',
      description: 'Supabase PostgreSQL'
    }
  ]}
/>
```

## 🎨 Design Tokens

### Animationer (Tailwind)
```css
.animate-fade-in-up    /* fadeInUp 0.5s ease-out */
.animate-scale-in      /* scaleIn 0.3s ease-out */
.animate-pulse-green   /* Green pulse för status */
.animate-shimmer       /* Shimmer effect för loading */
```

### Färger
- **Primary**: `#20c58f` (BeGone green)
- **Background**: `slate-950` (dark background)
- **Cards**: `slate-900` (card background)
- **Borders**: `slate-800` (subtle borders)
- **Text**: `white`, `slate-300`, `slate-400`, `slate-500`

## 🚀 Användning i andra Dashboard

### Koordinator Dashboard
```tsx
import { EnhancedKpiCard, QuickActionBar, VisualTimeline } from '../../components/shared'

// I koordinator dashboard
<EnhancedKpiCard
  title="Aktiva Ärenden"
  value={42}
  icon={Calendar}
  trend="up"
  trendValue="+8"
/>
```

### Tekniker Dashboard  
```tsx
import { EnhancedKpiCard, LiveStatusIndicator } from '../../components/shared'

// I tekniker dashboard
<EnhancedKpiCard
  title="Månadsbonus"
  value={15000}
  icon={Wallet}
  prefix=""
  suffix=" kr"
  trend="up"
  trendValue="+25%"
/>
```

### Economics Dashboard
```tsx
import { InteractiveRevenueChart, StaggeredGrid } from '../../components/shared'

// I economics dashboard
<InteractiveRevenueChart
  data={economicsData}
  size={200}
  className="mb-6"
/>
```

## 🔧 Performance

Alla komponenter är:
- **Memoized** med React.memo där relevant
- **Code split ready** för lazy loading
- **Bundle optimized** med tree shaking support
- **Animation optimized** med will-change och transform3d
- **Accessibility compliant** med ARIA labels och keyboard support

## 📱 Responsive Design

Alla komponenter fungerar på:
- Desktop (1200px+)
- Tablet (768px - 1199px)  
- Mobile (< 768px)

Med responsive breakpoints:
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+

## 🎯 Migration Guide

För att migrera befintliga sidor:

1. **Installera dependencies** (redan gjort):
   ```bash
   npm install react-countup react-spring cmdk react-hotkeys-hook
   ```

2. **Ersätt basic komponenter**:
   ```tsx
   // Innan
   <AdminKpiCard title="Test" value={100} icon={Users} />
   
   // Efter  
   <EnhancedKpiCard title="Test" value={100} icon={Users} trend="up" delay={0.1} />
   ```

3. **Lägg till animations**:
   ```tsx
   // Wrap card grids
   <StaggeredGrid className="grid grid-cols-4 gap-6">
     {cards}
   </StaggeredGrid>
   ```

4. **Förbättra loading states**:
   ```tsx
   // Innan
   <div className="animate-pulse bg-slate-800 h-20 rounded" />
   
   // Efter
   <EnhancedSkeleton variant="kpi" count={4} />
   ```

Detta komponentbibliotek ger BeGone Kundportal en konsekvent, professionell och imponerande användarupplevelse som skalerar genom hela systemet!