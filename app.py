import os
import json
import uuid
import base64
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
import eventlet
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Store active users and messages (in production, use Redis)
active_users = {}
chat_messages = []
MAX_MESSAGES = 1000

# Ensure uploads directory exists
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/save_photo', methods=['POST'])
def save_photo():
    try:
        data = request.get_json()
        if not data or 'photo' not in data:
            return jsonify({'success': False, 'error': 'No photo data provided'}), 400
        
        # Extract base64 data
        if 'data:image' in data['photo']:
            header, encoded = data['photo'].split(',', 1)
            photo_data = base64.b64decode(encoded)
        else:
            photo_data = base64.b64decode(data['photo'])
        
        # Generate unique filename
        filename = f"photo_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save file
        with open(filepath, 'wb') as f:
            f.write(photo_data)
        
        return jsonify({
            'success': True,
            'photo_url': f'/uploads/{filename}',
            'filename': filename
        })
    except Exception as e:
        app.logger.error(f"Error saving photo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup():
    """Cleanup old files (optional, can be scheduled)"""
    try:
        cutoff = datetime.now().timestamp() - (24 * 3600)  # 24 hours ago
        deleted = 0
        
        for filename in os.listdir(UPLOAD_FOLDER):
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.getctime(filepath) < cutoff:
                os.remove(filepath)
                deleted += 1
        
        return jsonify({'success': True, 'deleted': deleted})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    emit('connection_response', {'status': 'connected', 'id': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    user_id = request.sid
    if user_id in active_users:
        username = active_users[user_id]['username']
        del active_users[user_id]
        
        emit('user_left', {
            'username': username,
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'userCount': len(active_users)
        }, broadcast=True)
        
        emit('update_users', get_active_users_list(), broadcast=True)

@socketio.on('join')
def handle_join(data):
    try:
        username = data.get('username', '').strip()
        if not username or len(username) < 2 or len(username) > 20:
            emit('join_error', {'error': 'Username must be 2-20 characters'})
            return
        
        # Check if username already exists
        if any(user['username'].lower() == username.lower() for user in active_users.values()):
            emit('join_error', {'error': 'Username already taken'})
            return
        
        user_id = request.sid
        active_users[user_id] = {
            'username': username,
            'joined_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat()
        }
        
        join_room('main_room')
        
        # Send welcome message
        emit('user_joined', {
            'username': username,
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'userCount': len(active_users)
        }, broadcast=True)
        
        # Update user list for everyone
        emit('update_users', get_active_users_list(), broadcast=True)
        
        # Send last 50 messages to new user
        emit('message_history', chat_messages[-50:])
        
        # Confirm join to user
        emit('join_success', {
            'username': username,
            'userCount': len(active_users)
        })
        
    except Exception as e:
        app.logger.error(f"Join error: {str(e)}")
        emit('join_error', {'error': 'Internal server error'})

@socketio.on('send_message')
def handle_message(data):
    try:
        username = active_users.get(request.sid, {}).get('username', 'Unknown')
        message = data.get('message', '').strip()
        msg_type = data.get('type', 'text')
        
        if not message and msg_type == 'text':
            return
        
        # Update user's last active time
        if request.sid in active_users:
            active_users[request.sid]['last_active'] = datetime.now().isoformat()
        
        message_id = str(uuid.uuid4())
        message_data = {
            'id': message_id,
            'username': username,
            'message': message,
            'type': msg_type,
            'timestamp': datetime.now().strftime('%H:%M %p'),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'photo_url': data.get('photo_url', '')
        }
        
        # Store message
        chat_messages.append(message_data)
        if len(chat_messages) > MAX_MESSAGES:
            chat_messages.pop(0)
        
        # Broadcast to all
        emit('new_message', message_data, broadcast=True)
        
    except Exception as e:
        app.logger.error(f"Message error: {str(e)}")

@socketio.on('typing')
def handle_typing(data):
    try:
        username = active_users.get(request.sid, {}).get('username', '')
        if username:
            emit('user_typing', {
                'username': username,
                'is_typing': data.get('is_typing', False)
            }, broadcast=True, include_self=False)
    except Exception as e:
        app.logger.error(f"Typing error: {str(e)}")

@socketio.on('request_users')
def handle_users_request():
    emit('update_users', get_active_users_list())

def get_active_users_list():
    """Get list of active users for display"""
    return [
        {
            'username': user['username'],
            'joined_at': user['joined_at'][11:16]  # Just time
        }
        for user in active_users.values()
    ]

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=debug_mode,
        log_output=True
    )
