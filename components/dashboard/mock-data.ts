/* ── Mock discovery data for dashboard ── */

export interface MockInfluencer {
  id: string;
  name: string;
  handle: string;
  platform: "YouTube" | "TikTok" | "Instagram";
  followers: string;
  engagementRate: string;
  categories: string[];
  avatar: string; // initials-based placeholder
}

export interface MockKeyword {
  id: string;
  keyword: string;
  searchVolume: string;
  competition: "Low" | "Medium" | "High";
  trend: "Rising" | "Stable" | "Declining";
  categories: string[];
}

export interface MockHashtag {
  id: string;
  hashtag: string;
  postCount: string;
  growth: string;
  categories: string[];
}

export interface MockTopic {
  id: string;
  topic: string;
  description: string;
  heatScore: number; // 1-100
  categories: string[];
}

// ── Influencers ──

export const MOCK_INFLUENCERS: MockInfluencer[] = [
  { id: "inf-1", name: "Sarah Chen", handle: "@sarahfitlife", platform: "YouTube", followers: "1.2M", engagementRate: "4.8%", categories: ["Health & Fitness", "Sustainability & Eco"], avatar: "SC" },
  { id: "inf-2", name: "Marcus Rivera", handle: "@marcustech", platform: "TikTok", followers: "890K", engagementRate: "6.2%", categories: ["Tech & Gadgets", "Gaming"], avatar: "MR" },
  { id: "inf-3", name: "Aisha Patel", handle: "@aishabeauty", platform: "Instagram", followers: "2.1M", engagementRate: "3.9%", categories: ["Beauty & Skincare", "Fashion & Style"], avatar: "AP" },
  { id: "inf-4", name: "Jake Thompson", handle: "@jakecooks", platform: "YouTube", followers: "678K", engagementRate: "5.5%", categories: ["Food & Cooking", "Travel & Adventure"], avatar: "JT" },
  { id: "inf-5", name: "Luna Martinez", handle: "@lunalifestyle", platform: "TikTok", followers: "1.5M", engagementRate: "7.1%", categories: ["Fashion & Style", "Entertainment & Pop Culture"], avatar: "LM" },
  { id: "inf-6", name: "David Kim", handle: "@davidinvests", platform: "YouTube", followers: "445K", engagementRate: "4.2%", categories: ["Finance & Investing", "Business & Entrepreneurship"], avatar: "DK" },
  { id: "inf-7", name: "Emma Wilson", handle: "@emmagames", platform: "TikTok", followers: "3.2M", engagementRate: "8.1%", categories: ["Gaming", "Entertainment & Pop Culture"], avatar: "EW" },
  { id: "inf-8", name: "Tyler Brooks", handle: "@tyleroutdoors", platform: "YouTube", followers: "567K", engagementRate: "5.0%", categories: ["Travel & Adventure", "Sports"], avatar: "TB" },
  { id: "inf-9", name: "Nina Russo", handle: "@ninasings", platform: "Instagram", followers: "780K", engagementRate: "4.5%", categories: ["Music", "Art & Design"], avatar: "NR" },
  { id: "inf-10", name: "Chris Nguyen", handle: "@chrisgaming", platform: "TikTok", followers: "2.8M", engagementRate: "6.8%", categories: ["Gaming", "Tech & Gadgets"], avatar: "CN" },
  { id: "inf-11", name: "Olivia Hart", handle: "@oliviahome", platform: "Instagram", followers: "920K", engagementRate: "5.3%", categories: ["Home & DIY", "Sustainability & Eco"], avatar: "OH" },
  { id: "inf-12", name: "Ryan Patriot", handle: "@ryanpatriot", platform: "YouTube", followers: "1.8M", engagementRate: "7.4%", categories: ["Politics & Activism", "Business & Entrepreneurship"], avatar: "RP" },
  { id: "inf-13", name: "Mia Fernandez", handle: "@miafamily", platform: "TikTok", followers: "1.1M", engagementRate: "6.0%", categories: ["Parenting & Family", "Education & Learning"], avatar: "MF" },
  { id: "inf-14", name: "Jordan Lee", handle: "@jordansports", platform: "YouTube", followers: "2.4M", engagementRate: "5.7%", categories: ["Sports", "Health & Fitness"], avatar: "JL" },
  { id: "inf-15", name: "Sophia Ray", handle: "@sophiaeco", platform: "Instagram", followers: "340K", engagementRate: "8.9%", categories: ["Sustainability & Eco", "Fashion & Style"], avatar: "SR" },
  { id: "inf-16", name: "Ben Carter", handle: "@bencars", platform: "YouTube", followers: "1.6M", engagementRate: "4.1%", categories: ["Automotive", "Tech & Gadgets"], avatar: "BC" },
  { id: "inf-17", name: "Zoe Adams", handle: "@zoeartist", platform: "TikTok", followers: "520K", engagementRate: "9.2%", categories: ["Art & Design", "Music"], avatar: "ZA" },
  { id: "inf-18", name: "Ethan Moore", handle: "@ethanpets", platform: "Instagram", followers: "690K", engagementRate: "7.8%", categories: ["Pets & Animals", "Entertainment & Pop Culture"], avatar: "EM" },
  { id: "inf-19", name: "Hannah Fox", handle: "@hannahmaga", platform: "TikTok", followers: "2.0M", engagementRate: "6.5%", categories: ["Politics & Activism", "Entertainment & Pop Culture"], avatar: "HF" },
  { id: "inf-20", name: "Leo Zhang", handle: "@leolearn", platform: "YouTube", followers: "410K", engagementRate: "5.9%", categories: ["Education & Learning", "Tech & Gadgets"], avatar: "LZ" },
];

// ── Keywords ──

export const MOCK_KEYWORDS: MockKeyword[] = [
  { id: "kw-1", keyword: "home workout routines", searchVolume: "246K", competition: "Medium", trend: "Rising", categories: ["Health & Fitness"] },
  { id: "kw-2", keyword: "best skincare routine 2026", searchVolume: "189K", competition: "High", trend: "Rising", categories: ["Beauty & Skincare"] },
  { id: "kw-3", keyword: "AI productivity tools", searchVolume: "312K", competition: "High", trend: "Rising", categories: ["Tech & Gadgets", "Business & Entrepreneurship"] },
  { id: "kw-4", keyword: "passive income ideas", searchVolume: "420K", competition: "High", trend: "Stable", categories: ["Finance & Investing"] },
  { id: "kw-5", keyword: "meal prep for beginners", searchVolume: "156K", competition: "Low", trend: "Rising", categories: ["Food & Cooking", "Health & Fitness"] },
  { id: "kw-6", keyword: "hidden travel destinations", searchVolume: "98K", competition: "Low", trend: "Rising", categories: ["Travel & Adventure"] },
  { id: "kw-7", keyword: "streetwear fashion trends", searchVolume: "134K", competition: "Medium", trend: "Stable", categories: ["Fashion & Style"] },
  { id: "kw-8", keyword: "indie game reviews", searchVolume: "87K", competition: "Low", trend: "Rising", categories: ["Gaming"] },
  { id: "kw-9", keyword: "online learning platforms", searchVolume: "267K", competition: "High", trend: "Stable", categories: ["Education & Learning"] },
  { id: "kw-10", keyword: "small space organization", searchVolume: "178K", competition: "Medium", trend: "Rising", categories: ["Home & DIY"] },
  { id: "kw-11", keyword: "gentle parenting tips", searchVolume: "112K", competition: "Low", trend: "Rising", categories: ["Parenting & Family"] },
  { id: "kw-12", keyword: "celebrity drama explained", searchVolume: "534K", competition: "Medium", trend: "Stable", categories: ["Entertainment & Pop Culture"] },
  { id: "kw-13", keyword: "MAGA merch creators", searchVolume: "89K", competition: "Low", trend: "Rising", categories: ["Politics & Activism"] },
  { id: "kw-14", keyword: "eco friendly products", searchVolume: "203K", competition: "Medium", trend: "Rising", categories: ["Sustainability & Eco"] },
  { id: "kw-15", keyword: "exotic pet care guide", searchVolume: "67K", competition: "Low", trend: "Stable", categories: ["Pets & Animals"] },
  { id: "kw-16", keyword: "guitar tutorial beginner", searchVolume: "145K", competition: "Medium", trend: "Stable", categories: ["Music"] },
  { id: "kw-17", keyword: "digital art commission", searchVolume: "78K", competition: "Low", trend: "Rising", categories: ["Art & Design"] },
  { id: "kw-18", keyword: "EV car comparison 2026", searchVolume: "198K", competition: "High", trend: "Rising", categories: ["Automotive", "Tech & Gadgets"] },
  { id: "kw-19", keyword: "fantasy football strategy", searchVolume: "356K", competition: "High", trend: "Stable", categories: ["Sports"] },
  { id: "kw-20", keyword: "solopreneur tools stack", searchVolume: "92K", competition: "Low", trend: "Rising", categories: ["Business & Entrepreneurship"] },
];

// ── Hashtags ──

export const MOCK_HASHTAGS: MockHashtag[] = [
  { id: "ht-1", hashtag: "#FitTok", postCount: "12.4M", growth: "+18%", categories: ["Health & Fitness"] },
  { id: "ht-2", hashtag: "#GlassSkin", postCount: "8.7M", growth: "+24%", categories: ["Beauty & Skincare"] },
  { id: "ht-3", hashtag: "#TechReview", postCount: "15.2M", growth: "+9%", categories: ["Tech & Gadgets"] },
  { id: "ht-4", hashtag: "#MoneyTok", postCount: "6.3M", growth: "+31%", categories: ["Finance & Investing"] },
  { id: "ht-5", hashtag: "#FoodieFinds", postCount: "22.1M", growth: "+12%", categories: ["Food & Cooking"] },
  { id: "ht-6", hashtag: "#WanderlustVibes", postCount: "9.8M", growth: "+15%", categories: ["Travel & Adventure"] },
  { id: "ht-7", hashtag: "#OOTD", postCount: "45.6M", growth: "+5%", categories: ["Fashion & Style"] },
  { id: "ht-8", hashtag: "#GamerLife", postCount: "18.9M", growth: "+22%", categories: ["Gaming"] },
  { id: "ht-9", hashtag: "#StudyTok", postCount: "7.1M", growth: "+28%", categories: ["Education & Learning"] },
  { id: "ht-10", hashtag: "#HomeHacks", postCount: "11.3M", growth: "+19%", categories: ["Home & DIY"] },
  { id: "ht-11", hashtag: "#MomLife", postCount: "31.4M", growth: "+7%", categories: ["Parenting & Family"] },
  { id: "ht-12", hashtag: "#PopCulture", postCount: "14.6M", growth: "+11%", categories: ["Entertainment & Pop Culture"] },
  { id: "ht-13", hashtag: "#MAGA2026", postCount: "5.8M", growth: "+42%", categories: ["Politics & Activism"] },
  { id: "ht-14", hashtag: "#EcoFriendly", postCount: "8.2M", growth: "+20%", categories: ["Sustainability & Eco"] },
  { id: "ht-15", hashtag: "#PetsOfTikTok", postCount: "28.7M", growth: "+16%", categories: ["Pets & Animals"] },
  { id: "ht-16", hashtag: "#MusicProduction", postCount: "4.9M", growth: "+13%", categories: ["Music"] },
  { id: "ht-17", hashtag: "#DigitalArt", postCount: "6.7M", growth: "+25%", categories: ["Art & Design"] },
  { id: "ht-18", hashtag: "#CarTok", postCount: "10.1M", growth: "+17%", categories: ["Automotive"] },
  { id: "ht-19", hashtag: "#SportsHighlights", postCount: "19.3M", growth: "+8%", categories: ["Sports"] },
  { id: "ht-20", hashtag: "#StartupLife", postCount: "3.4M", growth: "+35%", categories: ["Business & Entrepreneurship"] },
  { id: "ht-21", hashtag: "#TrumpMerch", postCount: "2.1M", growth: "+56%", categories: ["Politics & Activism"] },
  { id: "ht-22", hashtag: "#PatriotCreators", postCount: "1.8M", growth: "+48%", categories: ["Politics & Activism"] },
];

// ── Trending Topics ──

export const MOCK_TOPICS: MockTopic[] = [
  { id: "tp-1", topic: "AI-Powered Fitness Coaching", description: "Creators using AI to build personalized workout plans", heatScore: 92, categories: ["Health & Fitness", "Tech & Gadgets"] },
  { id: "tp-2", topic: "Clean Beauty Movement", description: "Shift toward transparent ingredient lists and sustainable packaging", heatScore: 87, categories: ["Beauty & Skincare", "Sustainability & Eco"] },
  { id: "tp-3", topic: "Micro-SaaS for Creators", description: "Solopreneurs building tiny software tools for niche audiences", heatScore: 95, categories: ["Tech & Gadgets", "Business & Entrepreneurship"] },
  { id: "tp-4", topic: "Crypto Comeback 2026", description: "Renewed interest in DeFi and digital asset education", heatScore: 78, categories: ["Finance & Investing"] },
  { id: "tp-5", topic: "Fusion Street Food", description: "Cross-cultural food mashups going viral on social platforms", heatScore: 84, categories: ["Food & Cooking", "Travel & Adventure"] },
  { id: "tp-6", topic: "Slow Travel Vlogs", description: "Month-long stays in single destinations over rapid touring", heatScore: 81, categories: ["Travel & Adventure"] },
  { id: "tp-7", topic: "Y2K Fashion Revival", description: "Early 2000s fashion aesthetics making a strong comeback", heatScore: 76, categories: ["Fashion & Style", "Entertainment & Pop Culture"] },
  { id: "tp-8", topic: "Cozy Gaming Aesthetic", description: "Calm, low-stakes gaming content as self-care", heatScore: 89, categories: ["Gaming"] },
  { id: "tp-9", topic: "Patriot Creator Economy", description: "Conservative creators building merch empires and media brands", heatScore: 93, categories: ["Politics & Activism", "Business & Entrepreneurship"] },
  { id: "tp-10", topic: "EV Road Trip Content", description: "Electric vehicle owners documenting cross-country charging adventures", heatScore: 72, categories: ["Automotive", "Travel & Adventure"] },
  { id: "tp-11", topic: "AI Art Controversy", description: "Ongoing debate about AI-generated vs human-created art", heatScore: 88, categories: ["Art & Design", "Tech & Gadgets"] },
  { id: "tp-12", topic: "Pet Enrichment Hacks", description: "DIY toys and mental stimulation for pets going viral", heatScore: 79, categories: ["Pets & Animals", "Home & DIY"] },
  { id: "tp-13", topic: "MAGA Merch Collabs", description: "Political merchandise collaborations with influencer creators", heatScore: 91, categories: ["Politics & Activism"] },
  { id: "tp-14", topic: "4-Day Work Week Movement", description: "Companies and creators advocating for compressed schedules", heatScore: 83, categories: ["Business & Entrepreneurship"] },
  { id: "tp-15", topic: "Sports Betting Education", description: "Creators teaching responsible sports betting strategies", heatScore: 74, categories: ["Sports", "Finance & Investing"] },
];
