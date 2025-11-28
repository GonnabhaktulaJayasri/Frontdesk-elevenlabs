import cron from 'node-cron';
import scheduledCallService from '../services/scheduledCallService.js';

class ScheduledCallJob {
  start() {
    // Run every minute to check for scheduled calls
    cron.schedule('* * * * *', async () => {
      try {
        console.log('⏰ Checking for scheduled calls...');
        
        const pendingCalls = await scheduledCallService.getPendingCalls();
        
        if (pendingCalls.length === 0) {
          return;
        }
        
        console.log(`📞 Found ${pendingCalls.length} calls to execute`);
        
        // Execute calls in parallel (but limited concurrency)
        const MAX_CONCURRENT = 5;
        for (let i = 0; i < pendingCalls.length; i += MAX_CONCURRENT) {
          const batch = pendingCalls.slice(i, i + MAX_CONCURRENT);
          await Promise.all(
            batch.map(call => scheduledCallService.executeScheduledCall(call))
          );
        }
        
      } catch (error) {
        console.error('❌ Scheduled call job error:', error);
      }
    });
    
    console.log('Scheduled call job started (runs every minute)');
  }
}

export default new ScheduledCallJob();