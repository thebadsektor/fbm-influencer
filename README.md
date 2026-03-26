# Influencer Funnel Builder

AI-powered influencer scouting platform. Find creators, generate smart keywords, and build influencer funnels — built with Next.js, Better Auth, Prisma, and Stripe.

## Tech Stack

- **Framework:** [Next.js (App Router)](https://nextjs.org/)
- **Authentication:** [Better Auth](https://better-auth.com/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **Payments:** [Stripe](https://stripe.com/)
- **Email:** [SendGrid](https://sendgrid.com/)
- **Storage:** [MinIO](https://min.io/)
- **Design:** [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)

## Getting Started

### 1. Prerequisites

- Node.js (Latest LTS)
- PNPM installed (`npm install -g pnpm`)
- Docker (optional, for local Postgres/MinIO)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd saas-starter
pnpm install
```

### 3. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Review `.env` and provide values for:
- Database connection string
- Google OAuth credentials
- Better Auth secret
- Stripe keys and Price IDs
- SendGrid API key
- MinIO configuration

### 4. Database Setup

Ensure your PostgreSQL instance is running, then set up the schema:

```bash
pnpm prisma generate
pnpm prisma db push
```

*Note: Use `pnpm prisma migrate dev` for production-grade migrations.*

### 5. Stripe Configuration

1. Set up your products and prices in the Stripe Dashboard.
2. Update the `STRIPE_*_PRICE_ID_*` variables in your `.env`.
3. For local webhook testing, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```
4. Update `STRIPE_WEBHOOK_SECRET` with the key provided by the CLI.

### 6. Running Locally

Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Features

- **Authentication:** Secure login with Google and email/password.
- **Subscription Management:** Tiered plans (Plus, Enterprise) powered by Stripe.
- **Gated Content:** Feature-level access control based on user subscriptions.
- **Admin Dashboard:** Manage users, monitor subscriptions, and send notifications.
- **Feedback System:** Integrated user feedback and discussion boards.
- **Storage:** S3-compatible file uploads via MinIO.
- **Emails:** Transactional emails for verification and notifications via SendGrid.

## Project Structure

- `app/`: Next.js App Router pages and layouts.
- `components/`: Reusable UI components.
- `lib/`: Utilities, constants, and database client.
- `prisma/`: Database schema and migrations.
- `config/`: Application configuration (Stripe, Auth).

## License

This project is licensed under the MIT License.
