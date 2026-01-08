# AUTH DETECTOR

A **Neo-Brutalist** web application that extracts authentication components from any website. Built with Next.js 16 and featuring bold, high-contrast design with Space Grotesk typography.

![Neo-Brutalist Design](https://img.shields.io/badge/Design-Neo--Brutalist-c8ff00?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Font**: Space Grotesk (Google Fonts)
- **Web Scraping**: Puppeteer + Cheerio
- **Syntax Highlighting**: react-syntax-highlighter

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/JayJoshi4520/auth-detector.git
cd auth-detector
cp .env.example .env
```
#### Update your Gemini API Key in .env file.
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

### 4. Open in browser

Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter any website URL in the input field (e.g., `https://github.com/login`)
2. Click **EXTRACT AUTH →**
3. Wait for the scanner animation to complete
4. View the extracted HTML source code with syntax highlighting
5. See a live preview of the isolated auth component


## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```


## Note: Many websites have anti-bot measures in place such as (captcha, Cloudflare, etc.) so the scraper may not work on all websites.



## List of URLs used for testing

1. https://account.box.com/login **(SaaS)**
2. https://github.com/login **(SaaS)**
3. https://www.reddit.com/login/ **(Blogs)**
4. https://substack.com/sign-in **(Blogs)**
5. https://www.facebook.com/login **(Social)**
6. https://www.linkedin.com/login **(Social)**
7. https://www.flipkart.com/account/login **(E-Commerce)**
8. https://auth.ndtv.com/w/sso.html **(NEWS)**
10. https://timesofindia.indiatimes.com/login.cms?newlook=1&signin=1 **(NEWS)**



**Built with ❤️ by Jay Joshi using Next.js**
