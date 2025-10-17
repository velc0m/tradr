# Tradr - Crypto Trading Tracker

A modern cryptocurrency trading tracker built with Next.js 14, TypeScript, and MongoDB.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** NextAuth.js
- **UI Components:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS
- **PWA:** next-pwa

## Features

- User authentication (sign up, sign in)
- Portfolio management
- Trade tracking (entry/exit prices, fees, profit/loss)
- Dark mode by default
- Progressive Web App (PWA) support
- Responsive design

## Project Structure

```
tradr/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── auth/           # Authentication pages
│   │   ├── dashboard/      # Dashboard pages
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home page
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── features/      # Feature-specific components
│   │   ├── layouts/       # Layout components
│   │   └── providers/     # Context providers
│   ├── lib/               # Utilities and configurations
│   │   ├── mongodb.ts     # MongoDB connection
│   │   ├── auth.ts        # NextAuth configuration
│   │   └── utils.ts       # Helper functions
│   ├── models/            # Mongoose models
│   │   ├── User.ts        # User model
│   │   ├── Portfolio.ts   # Portfolio model
│   │   └── Trade.ts       # Trade model
│   ├── services/          # Business logic and API calls
│   └── types/             # TypeScript type definitions
│       ├── index.ts       # Main types
│       └── next-auth.d.ts # NextAuth type extensions
├── public/                # Static files
│   └── manifest.json      # PWA manifest
├── .env.example           # Environment variables template
├── components.json        # shadcn/ui configuration
├── next.config.js         # Next.js configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tradr
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/tradr?retryWrites=true&w=majority

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your_generated_secret_key

# Application URL
NEXTAUTH_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### Setting up MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (free tier available)
3. Create a database user
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string and add it to `.env`

### Generating NextAuth Secret

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## MongoDB Models

### User Model
```typescript
{
  email: string (unique, required)
  password: string (hashed, required)
  createdAt: Date
}
```

### Portfolio Model
```typescript
{
  userId: string (ref: User, required)
  name: string (required)
  totalDeposit: number (required)
  coins: [{
    symbol: string (required)
    percentage: number (required, 0-100)
    decimalPlaces: number (required, 0-8)
  }]
  createdAt: Date
  updatedAt: Date
}
```

### Trade Model
```typescript
{
  portfolioId: string (ref: Portfolio, required)
  coinSymbol: string (required)
  status: 'OPEN' | 'CLOSED' (required)
  entryPrice: number (required)
  depositPercent: number (required, 0-100)
  entryFee: number (required)
  exitPrice?: number
  exitFee?: number
  amount: number (required)
  openDate: Date (required)
  closeDate?: Date
  createdAt: Date
  updatedAt: Date
}
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check

## Building for Production

```bash
npm run build
npm start
```

## PWA Features

The application is configured as a Progressive Web App:

- Installable on desktop and mobile devices
- Offline support (via service worker)
- App-like experience
- Custom manifest with icons

**Note:** PWA features are disabled in development mode.

## Type Safety

This project uses strict TypeScript configuration:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- No `any` types allowed (enforced by ESLint)

## Code Style

- Components are organized by feature
- Utility functions are in `@/lib`
- API routes follow REST conventions
- All code comments are in English

## Next Steps

After setting up the project, you can:

1. Create additional UI components for portfolio management
2. Implement trade CRUD operations
3. Add charts and analytics
4. Implement real-time price fetching
5. Add export functionality
6. Implement advanced filtering and sorting

## Troubleshooting

### MongoDB Connection Issues

- Verify your connection string in `.env`
- Check if your IP is whitelisted in MongoDB Atlas
- Ensure database user credentials are correct

### NextAuth Issues

- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your development/production URL
- Clear browser cookies if experiencing session issues

### Build Errors

- Run `npm run type-check` to identify TypeScript errors
- Ensure all dependencies are installed: `npm install`
- Clear `.next` folder: `rm -rf .next`

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
