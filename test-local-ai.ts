/**
 * Test script for local AI connection
 * Run: npx ts-node test-local-ai.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://localhost:5000';
const session_id = `test_${Date.now()}`;

async function testLocalAI() {
  console.log('='.repeat(60));
  console.log('Local AI Connection Test');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Check server health
  console.log('1. Checking server health...');
  try {
    const response = await axios.get(`${LOCAL_AI_URL}/health`, { timeout: 5000 });
    console.log(`   ✓ Server is running: ${JSON.stringify(response.data)}`);
  } catch (error: any) {
    console.log(`   ✗ Server not running: ${error.message}`);
    console.log(`   Make sure your AI server is running at ${LOCAL_AI_URL}`);
    process.exit(1);
  }

  console.log();

  // Step 2: Login (optional)
  console.log('2. Logging in to AI server...');
  try {
    const response = await axios.post(`${LOCAL_AI_URL}/api/chat/login`, {
      platform: 'deepseek',
      email: process.env.LOCAL_AI_EMAIL,
      password: process.env.LOCAL_AI_PASSWORD,
      session_id: session_id,
    }, { timeout: 5000 });
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data)}`);
  } catch (error: any) {
    console.log(`   ⚠ Login failed: ${error.message}`);
    console.log('   Continuing anyway (login may not be required)...');
  }

  console.log();

  // Step 3: Test trading decision
  console.log('3. Sending test trading prompt...');
  
  const testPrompt = `You are a crypto trading AI. Based on this data, make a decision:

Current Account:
- Equity: $10,000 USDT
- No open positions

Market Data:
- BTCUSDT: $45,000 (RSI: 65, trending up)
- ETHUSDT: $2,500 (RSI: 45, consolidating)

Historical Performance:
- Last 5 trades: 3 wins, 2 losses
- Win rate: 60%

Provide your Chain of Thought reasoning, then output a JSON array of decisions.
Example: [{"action": "open_long", "symbol": "BTCUSDT", "quantity": 0.01, "leverage": 10, "stopLoss": 43000, "takeProfit": 47000, "reasoning": "Strong uptrend", "confidence": 0.8}]`;

  try {
    console.log('   Sending prompt to AI...');
    const response = await axios.post(`${LOCAL_AI_URL}/api/chat/send`, {
      platform: 'deepseek',
      message: testPrompt,
      session_id: session_id,
    }, { timeout: 60000 });

    if (response.status === 200 && response.data.response) {
      console.log(`   ✓ AI responded successfully`);
      console.log();
      console.log('   ' + '='.repeat(56));
      console.log(`   AI Response:`);
      console.log(`   ${response.data.response.substring(0, 500)}...`);
      console.log('   ' + '='.repeat(56));
      console.log();

      // Try to parse JSON from response
      const jsonMatch = response.data.response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const decisions = JSON.parse(jsonMatch[0]);
          console.log(`   ✓ Successfully parsed ${decisions.length} trading decision(s)`);
          console.log(`   Decisions:`, JSON.stringify(decisions, null, 2));
        } catch (e) {
          console.log(`   ⚠ Could not parse JSON decisions from response`);
        }
      } else {
        console.log(`   ⚠ No JSON array found in response`);
      }
    } else {
      console.log(`   ✗ Invalid response from AI server`);
    }
  } catch (error: any) {
    console.log(`   ✗ Failed to get AI response: ${error.message}`);
    process.exit(1);
  }

  console.log();

  // Step 4: Close session
  console.log('4. Closing session...');
  try {
    await axios.post(`${LOCAL_AI_URL}/api/chat/close`, {
      platform: 'deepseek',
      session_id: session_id,
    }, { timeout: 3000 });
    console.log(`   ✓ Session closed`);
  } catch (error: any) {
    console.log(`   ⚠ Could not close session: ${error.message}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Test Complete! ✅');
  console.log('='.repeat(60));
  console.log();
  console.log('Your local AI is ready for trading decisions!');
  console.log('Run: npm start');
}

testLocalAI().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
