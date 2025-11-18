const AttendanceToken = require('../models/AttendanceToken');

class QRAutoGenerator {
  constructor() {
    this.intervalId = null;
    this.intervalMs = 60 * 1000; // 1 minute
    this.isRunning = false;
  }

  async generateQR() {
    try {
      console.log('🔄 Auto-generating QR code...');
      
      // Get next sequence number
      const sequenceNumber = await AttendanceToken.getNextSequence();
      
      // Generate unique token
      const token = AttendanceToken.generateToken();
      
      // Set validity: 1 minute from now
      const validFrom = new Date();
      const validTo = new Date(validFrom.getTime() + this.intervalMs);
      
      // Create new QR token
      const qrToken = await AttendanceToken.create({
        token,
        validFrom,
        validTo,
        status: 'active',
        sequenceNumber
      });
      
      // Expire all previous active tokens
      await AttendanceToken.updateMany(
        { 
          _id: { $ne: qrToken._id },
          status: 'active'
        },
        { status: 'expired' }
      );
      
      // Cleanup: Keep only last 10 QR codes
      const tokensToKeep = await AttendanceToken.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id');
      
      const idsToKeep = tokensToKeep.map(t => t._id);
      
      const deleteResult = await AttendanceToken.deleteMany({
        _id: { $nin: idsToKeep }
      });
      
      console.log(`✅ Generated QR #${sequenceNumber}, expired old tokens, deleted ${deleteResult.deletedCount} old QRs`);
      
      return qrToken;
    } catch (error) {
      console.error('❌ Error auto-generating QR code:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  QR Auto-Generator is already running');
      return;
    }

    console.log('🚀 Starting QR Auto-Generator...');
    console.log(`⏱️  Interval: ${this.intervalMs / 1000} seconds`);
    
    // Generate first QR immediately
    try {
      await this.generateQR();
    } catch (error) {
      console.error('❌ Failed to generate initial QR:', error);
    }
    
    // Set up interval to generate new QR every minute
    this.intervalId = setInterval(async () => {
      try {
        await this.generateQR();
      } catch (error) {
        console.error('❌ Failed to auto-generate QR:', error);
      }
    }, this.intervalMs);
    
    this.isRunning = true;
    console.log('✅ QR Auto-Generator started successfully');
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  QR Auto-Generator is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('🛑 QR Auto-Generator stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      intervalSeconds: this.intervalMs / 1000
    };
  }
}

// Export singleton instance
module.exports = new QRAutoGenerator();

