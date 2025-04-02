/**
 * Telegram API utility functions
 * Port of Python telegram_utils.py functionality
 */

/**
 * Send a message to a Telegram chat
 * @param {string} token - Telegram bot token
 * @param {string|number} chatId - Target chat ID
 * @param {string} text - Message text to send
 * @returns {Promise<number|null>} - Message ID if successful, null otherwise
 */
async function sendTelegramMessage(token, chatId, text) {
    // Validation
    if (!token || !chatId || !text) {
      console.error('Missing required parameters for sending Telegram message');
      return null;
    }
    
    // Track retry attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
          })
        });
        
        const data = await response.json();
        
        if (data.ok) {
          console.log(`Message sent successfully to chat ID ${chatId}`);
          // Log the message for debugging
          logSentMessage(chatId, text);
          return data.result.message_id;
        } else {
          console.error(`Failed to send message: ${data.description}`);
          // If this is not the last attempt, wait before retrying
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
          }
        }
      } catch (error) {
        console.error(`Error sending message (attempt ${attempt + 1}/3):`, error);
        // If this is not the last attempt, wait before retrying
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
        }
      }
    }
    
    // All attempts failed
    console.error(`Failed to send message after 3 attempts`);
    return null;
  }
  
  /**
   * Send multiple messages sequentially
   * @param {Array} messages - Array of [text, chatId] tuples
   * @param {string} token - Telegram bot token
   * @returns {Promise<void>}
   */
  async function sendMessagesSequentially(messages, token) {
    for (const [text, chatId] of messages) {
      await sendTelegramMessage(token, chatId, text);
      // Small delay to avoid hitting Telegram API limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  /**
   * Edit a previously sent message
   * @param {string} token - Telegram bot token
   * @param {string|number} chatId - Target chat ID
   * @param {number} messageId - ID of the message to edit
   * @param {string} newText - New text for the message
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function editTelegramMessage(token, chatId, messageId, newText) {
    // Validation
    if (!token || !chatId || !messageId || !newText) {
      console.error('Missing required parameters for editing Telegram message');
      return false;
    }
    
    // Track retry attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: newText,
            parse_mode: 'HTML'
          })
        });
        
        const data = await response.json();
        
        if (data.ok) {
          console.log(`Message edited successfully for chat_id=${chatId}, message_id=${messageId}`);
          return true;
        } else {
          console.error(`Failed to edit message: ${data.description}`);
          // If this is not the last attempt, wait before retrying
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
          }
        }
      } catch (error) {
        console.error(`Error editing message (attempt ${attempt + 1}/3):`, error);
        // If this is not the last attempt, wait before retrying
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
        }
      }
    }
    
    // All attempts failed
    console.error(`Failed to edit message after 3 attempts`);
    return false;
  }
  
  /**
   * Log sent messages for debugging
   * @param {string|number} chatId - Recipient chat ID
   * @param {string} text - Message text
   */
  function logSentMessage(chatId, text) {
    const timestamp = new Date().toISOString();
    const log = {
      timestamp,
      chatId,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    };
    
    console.log('Message logged:', log);
    
    // Get existing logs
    chrome.storage.local.get('messageLog', data => {
      const logs = data.messageLog || [];
      logs.push(log);
      
      // Keep only the most recent 100 messages
      if (logs.length > 100) {
        logs.shift();
      }
      
      // Save updated logs
      chrome.storage.local.set({ messageLog: logs });
    });
  }
  
  // Export functions for use in other files
  export {
    sendTelegramMessage,
    sendMessagesSequentially,
    editTelegramMessage
  };