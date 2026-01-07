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
3. https://stackoverflow.com/users/login **(Blogs)**
4. https://substack.com/sign-in **(Blogs)**
5. https://www.facebook.com/login **(Social)**
6. https://www.linkedin.com/login **(Social)**
7. https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F%3Fref_%3Dnav_ya_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0 **(E-Commerce)**
8. https://identity.walmart.com/account/login?client_id=5f3fb121-076a-45f6-9587-249f0bc160ff&redirect_uri=https%3A%2F%2Fwww.walmart.com%2Faccount%2FverifyToken&scope=openid+email+offline_access&tenant_id=elh9ie&state=%2F&code_challenge=4ES0ihNkr2uO1wsSAchvCGt5Hw6j-pcXZUbgUystzRk **(E-Commerce)**
9. https://login.disney.com/en-US/US/DATG-OTV.KABC.WEB/interaction **(NEWS)**
10. https://auth.usnews.com/login?client_id=2q17ud509vvjvs5svj5ql4tt1q&response_type=code&scope=openid+email+profile+aws.cognito.signin.user.admin&redirect_uri=https://www.usnews.com/login-redirect **(NEWS)**



**Built with ❤️ by Jay Joshi using Next.js**
