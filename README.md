# AI Copy Assistant

A Next.js 14 application that helps developers improve bad UI copy using AI-powered suggestions from GPT-4o via OpenRouter.

## Features

- **AI-Powered Copy Improvement**: Get 2-3 better alternatives for any UI text
- **Context-Aware**: Different product types with specific tone/style instructions
- **Visual Context**: Upload screenshots for better AI understanding
- **Admin Management**: Manage product types and AI instructions
- **Modern UI**: Built with Next.js 14, Tailwind CSS, and shadcn/ui

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter GPT-4o
- **File Upload**: React Dropzone
- **TypeScript**: Full type safety

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd copyfixer
npm install
```

### 2. Environment Variables

Create `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter Configuration  
OPENROUTER_API_KEY=your_openrouter_api_key

# Admin Configuration
ADMIN_SECRET_CODE=your_admin_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

Create these tables in Supabase:

```sql
-- Product Types table
CREATE TABLE product_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Submissions table  
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bad_copy TEXT NOT NULL,
  product_type_id UUID REFERENCES product_types(id),
  suggestions TEXT[] NOT NULL,
  has_screenshot BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sample data
INSERT INTO product_types (name, slug, instructions) VALUES
('E-commerce', 'ecommerce', 'Write conversion-focused copy that drives sales. Use urgency, benefits, and clear CTAs. Keep it concise and customer-focused.'),
('SaaS', 'saas', 'Write professional, benefit-driven copy that explains value clearly. Use active voice and focus on outcomes.'),
('Mobile App', 'mobile', 'Write concise, action-oriented copy optimized for small screens. Use simple language and clear instructions.');
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### For Developers

1. **Main Page**: Paste bad copy, select product type, optionally upload screenshot
2. **Generate**: Click "Generate Suggestions" to get AI-improved alternatives  
3. **Copy**: Click any suggestion to copy it to your clipboard

### For Admins

1. **Admin Login**: Visit `/admin` and enter the secret code
2. **Manage Product Types**: Add, edit, or delete product types and their AI instructions
3. **Customize AI**: Write specific instructions for different product contexts

## API Endpoints

### Generate Suggestions
```
POST /api/generate
Content-Type: multipart/form-data

Body:
- badCopy: string (required)
- productTypeId: string (required) 
- screenshot: File (optional)

Response:
{
  "suggestions": string[]
}
```

### Product Types
```
GET /api/product-types
Response: ProductType[]

POST /api/product-types  
Content-Type: application/json
Body: { name: string, instructions: string }
Response: ProductType
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main developer interface
│   ├── admin/page.tsx        # Admin dashboard
│   └── api/
│       ├── generate/route.ts # AI generation endpoint
│       └── product-types/route.ts # CRUD operations
├── components/ui/            # shadcn/ui components
├── lib/
│   ├── supabase.ts          # Database client
│   ├── openrouter.ts        # AI client
│   └── utils.ts             # Helper functions
└── globals.css              # Global styles
```

## Deployment

1. **Vercel** (Recommended):
   ```bash
   vercel --prod
   ```

2. **Environment Variables**: Add all `.env.local` variables to your deployment platform

3. **Database**: Ensure Supabase tables are created and RLS is configured

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
