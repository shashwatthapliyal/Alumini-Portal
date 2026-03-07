import pool from '../config/db.js';

export class Message {
  constructor(messageData) {
    this.id = messageData.id;
    this.sender_id = messageData.sender_id;
    this.receiver_id = messageData.receiver_id;
    this.message = messageData.message;
    this.sent_at = messageData.sent_at;
    this.read_status = messageData.read_status;
  }

  static async create(messageData) {
    const { sender_id, receiver_id, message } = messageData;
    
    const query = `
      INSERT INTO messages (sender_id, receiver_id, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [sender_id, receiver_id, message];
    const result = await pool.query(query, values);
    return new Message(result.rows[0]);
  }

  static async findById(id) {
    const query = `
      SELECT m.*, 
             su.name as sender_name, su.email as sender_email,
             ru.name as receiver_name, ru.email as receiver_email
      FROM messages m
      JOIN users su ON m.sender_id = su.id
      JOIN users ru ON m.receiver_id = ru.id
      WHERE m.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getConversation(user1_id, user2_id, limit = 50, offset = 0) {
    const query = `
      SELECT m.*, 
             su.name as sender_name, su.email as sender_email,
             ru.name as receiver_name, ru.email as receiver_email
      FROM messages m
      JOIN users su ON m.sender_id = su.id
      JOIN users ru ON m.receiver_id = ru.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.sent_at ASC
      LIMIT $3 OFFSET $4
    `;
    
    const values = [user1_id, user2_id, limit, offset];
    const result = await pool.query(query, values);
    return result.rows;
  }

  static async getConversationsForUser(user_id) {
    const query = `
      SELECT DISTINCT 
        CASE 
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END as other_user_id,
        CASE 
          WHEN m.sender_id = $1 THEN ru.name
          ELSE su.name
        END as other_user_name,
        CASE 
          WHEN m.sender_id = $1 THEN ru.email
          ELSE su.email
        END as other_user_email,
        CASE 
          WHEN m.sender_id = $1 THEN ru.role
          ELSE su.role
        END as other_user_role,
        MAX(m.sent_at) as last_message_time,
        COUNT(CASE WHEN m.receiver_id = $1 AND m.read_status = false THEN 1 END) as unread_count
      FROM messages m
      JOIN users su ON m.sender_id = su.id
      JOIN users ru ON m.receiver_id = ru.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      GROUP BY other_user_id, other_user_name, other_user_email, other_user_role
      ORDER BY last_message_time DESC
    `;
    
    const result = await pool.query(query, [user_id]);
    return result.rows;
  }

  static async markAsRead(message_id) {
    const query = `
      UPDATE messages 
      SET read_status = true
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [message_id]);
    return result.rows[0] ? new Message(result.rows[0]) : null;
  }

  static async markConversationAsRead(user1_id, user2_id) {
    const query = `
      UPDATE messages 
      SET read_status = true
      WHERE ((sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1))
        AND read_status = false
      RETURNING *
    `;
    const result = await pool.query(query, [user1_id, user2_id]);
    return result.rows;
  }

  static async getUnreadCount(user_id) {
    const query = `
      SELECT COUNT(*) as count
      FROM messages 
      WHERE receiver_id = $1 AND read_status = false
    `;
    const result = await pool.query(query, [user_id]);
    return parseInt(result.rows[0].count);
  }

  static async delete(id) {
    const query = 'DELETE FROM messages WHERE id = $1';
    await pool.query(query, [id]);
  }

  static async deleteConversation(user1_id, user2_id) {
    const query = `
      DELETE FROM messages 
      WHERE (sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1)
    `;
    await pool.query(query, [user1_id, user2_id]);
  }

  toJSON() {
    return {
      id: this.id,
      sender_id: this.sender_id,
      receiver_id: this.receiver_id,
      message: this.message,
      sent_at: this.sent_at,
      read_status: this.read_status
    };
  }
}
