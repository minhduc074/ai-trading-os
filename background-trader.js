// Background Trading Service
// Run this independently: node background-trader.js

require('dotenv').config({ path: '.env.local' });

const DECISION_INTERVAL = parseInt(process.env.DECISION_INTERVAL_MS || '900000', 10);
const API_BASE = 'http://localhost:3000';

console.log('🤖 AI Trader Background Service Starting...');
console.log(`📊 Decision Interval: ${DECISION_INTERVAL / 60000} minutes`);
console.log(`🔗 API: ${API_BASE}`);
console.log('');

async function makeTradingDecision() {
  try {
    console.log(`[${new Date().toISOString()}] 🤔 Requesting AI trading decision...`);
    
    const decisionResponse = await fetch(`${API_BASE}/api/trading/decision`, {
      method: 'POST',
    });
    
    if (!decisionResponse.ok) {
      throw new Error(`Decision API failed: ${decisionResponse.status}`);
    }
    
    const decision = await decisionResponse.json();
    console.log(`✅ Decision: ${decision.action}`);
    console.log(`💭 Reasoning: ${decision.reasoning.substring(0, 100)}...`);
    console.log(`🎯 Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    console.log(`🤖 AI Agent: ${decision.aiAgent}`);
    
    // Execute the decision
    if (decision.action !== 'WAIT') {
      console.log(`⚡ Executing trade...`);
      
      const executeResponse = await fetch(`${API_BASE}/api/trading/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      });
      
      if (!executeResponse.ok) {
        throw new Error(`Execute API failed: ${executeResponse.status}`);
      }
      
      const result = await executeResponse.json();
      console.log(`✅ Execution complete:`, result.message);
    } else {
      console.log(`⏸️  No action taken (WAIT decision)`);
    }
    
    console.log(`⏰ Next decision in ${DECISION_INTERVAL / 60000} minutes`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.log('');
  }
}

// Initial decision
console.log('🚀 Making initial trading decision...\n');
makeTradingDecision();

// Set up interval for continuous trading
setInterval(makeTradingDecision, DECISION_INTERVAL);

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Background trader stopped');
  process.exit(0);
});

console.log('✅ Background trader is now running');
console.log('Press Ctrl+C to stop\n');
