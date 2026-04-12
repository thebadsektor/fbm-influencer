const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkState() {
  try {
    console.log('=== CAMPAIGNS ===');
    const campaigns = await prisma.campaign.findMany({
      include: {
        khSets: { select: { id: true } },
        iterations: { select: { id: true } }
      }
    });
    
    for (const c of campaigns) {
      const results = await prisma.result.count({
        where: { khSet: { campaignId: c.id } }
      });
      const profiled = await prisma.result.count({
        where: { 
          khSet: { campaignId: c.id },
          affinityProfile: { not: null }
        }
      });
      
      console.log(`\nCampaign: ${c.name}`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Target Leads: ${c.targetLeads}`);
      console.log(`  Max Iterations: ${c.maxIterations}`);
      console.log(`  KH Sets: ${c.khSets.length}`);
      console.log(`  Total Results: ${results}`);
      console.log(`  Profiled Results: ${profiled}`);
      console.log(`  Iterations: ${c.iterations.length}`);
    }
    
    console.log('\n\n=== KH SETS ===');
    const khSets = await prisma.khSet.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    for (const ks of khSets) {
      const resultCount = await prisma.result.count({
        where: { khSetId: ks.id }
      });
      console.log(`\nID: ${ks.id}`);
      console.log(`  Status: ${ks.status}`);
      console.log(`  Iteration: ${ks.iterationNumber}`);
      console.log(`  Total Scraped: ${ks.totalScraped}`);
      console.log(`  Results: ${resultCount}`);
      console.log(`  Created: ${ks.createdAt}`);
      console.log(`  Updated: ${ks.updatedAt}`);
    }
    
    console.log('\n\n=== CAMPAIGN ITERATIONS ===');
    const iterations = await prisma.campaignIteration.findMany({
      orderBy: { iterationNumber: 'asc' }
    });
    
    for (const it of iterations) {
      console.log(`\nIteration ${it.iterationNumber}:`);
      console.log(`  Results Count: ${it.resultsCount}`);
      console.log(`  Profiled Count: ${it.profiledCount}`);
      console.log(`  Skipped Count: ${it.skippedCount}`);
      console.log(`  Avg Fit Score: ${it.avgFitScore}`);
      console.log(`  Profiling Cost: ${it.profilingCost}`);
      console.log(`  Profiling Duration: ${it.profilingDuration}`);
      console.log(`  Discovery Duration: ${it.discoveryDuration}`);
      console.log(`  Narrative: ${it.analysisNarrative?.substring(0, 100)}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkState();
