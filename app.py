from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
import os
from datetime import datetime
import base64
import uuid
import json

# Initialize Flask app
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)  # Enable CORS for all routes

# Configure secret key for session management
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'chatnest-prod-secret-2024')

# Initialize SocketIO with async_mode
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Store active users and messages (in production, use Redis or database)
active_users = {}
chat_messages = []
MAX_MESSAGES = 1000  # Limit messages in memory

@app.route('/')
def index():
    """Serve the main chat interface"""
    return render_template('index.html')

@app.route('/health')
def health_check():
    """Health check endpoint for Render"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory(app.static_folder, filename)

@app.route('/save_photo', methods=['POST'])
def save_photo():
    """Handle photo uploads"""
    try:
        data = request.get_json()
        if not data or 'photo' not in data:
            return jsonify({'success': False, 'error': 'No photo data provided'}), 400
        
        # Extract base64 data
        if 'base64,' in data['photo']:
            photo_data = data['photo'].split('base64,')[1]
        else:
            photo_data = data['photo']
        
        # Generate unique filename
        photo_name = f"photo_{uuid.uuid4().hex[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        
        # In a production environment, you would save to cloud storage (S3, etc.)
        # For now, we'll just return success with the data
        return jsonify({
            'success': True,
            'photo_url': f"data:image/png;base64,{photo_data}",
            'photo_name': photo_name,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# SocketIO Event Handlers
@socketio.on('connect')
def handle_connect():
    """Handle new client connection"""
    print(f'Client connected: {request.sid}')
    emit('connection_established', {'message': 'Connected to Chat Nest'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    user_id = request.sid
    if user_id in active_users:
        username = active_users[user_id]
        user_data = active_users.pop(user_id)
        
        emit('user_left', {
            'username': username,
            'user_id': user_id,
            'timestamp': datetime.now().strftime('%H:%M:%S')
        }, broadcast=True)
        
        emit('update_users', {
            'users': list(active_users.values()),
            'count': len(active_users)
        }, broadcast=True)
        
        print(f'User disconnected: {username} ({user_id})')

@socketio.on('join')
def handle_join(data):
    """Handle user joining the chat"""
    try:
        username = data.get('username', '').strip()
        if not username or len(username) < 2:
            emit('join_error', {'error': 'Username must be at least 2 characters'})
            return
        
        if len(username) > 20:
            emit('join_error', {'error': 'Username must be 20 characters or less'})
            return
        
        user_id = request.sid
        
        # Check if username already exists
        if username in [user['username'] for user in active_users.values()]:
            emit('join_error', {'error': 'Username already taken'})
            return
        
        # Store user information
        active_users[user_id] = {
            'username': username,
            'joined_at': datetime.now().isoformat(),
            'user_id': user_id
        }
        
        join_room('main_room')
        
        # Notify everyone about new user
        emit('user_joined', {
            'username': username,
            'user_id': user_id,
            'timestamp': datetime.now().strftime('%H:%M:%S')
        }, broadcast=True)
        
        # Send updated user list to everyone
        emit('update_users', {
            'users': [user['username'] for user in active_users.values()],
            'count': len(active_users)
        }, broadcast=True)
        
        # Send last 50 messages to new user
        emit('message_history', {
            'messages': chat_messages[-50:] if chat_messages else []
        })
        
        print(f'User joined: {username} ({user_id})')
        
    except Exception as e:
        emit('join_error', {'error': f'Error joining chat: {str(e)}'})

@socketio.on('send_message')
def handle_message(data):
    """Handle new chat messages"""
    try:
        message = data.get('message', '').strip()
        message_type = data.get('type', 'text')
        username = data.get('username', '')
        
        if not message or not username:
            return
        
        user_id = request.sid
        if user_id not in active_users:
            return
        
        # Create message object
        message_data = {
            'id': str(uuid.uuid4()),
            'username': username,
            'user_id': user_id,
            'message': message,
            'type': message_type,
            'timestamp': datetime.now().strftime('%H:%M %p'),
            'full_timestamp': datetime.now().isoformat()
        }
        
        # Add photo URL if present
        if message_type == 'photo' and 'photo_url' in data:
            message_data['photo_url'] = data['photo_url']
        
        # Store message (with limit)
        chat_messages.append(message_data)
        if len(chat_messages) > MAX_MESSAGES:
            chat_messages.pop(0)
        
        # Broadcast to all clients
        emit('new_message', message_data, broadcast=True, room='main_room')
        
    except Exception as e:
        print(f'Error handling message: {e}')

@socketio.on('typing')
def handle_typing(data):
    """Handle typing indicators"""
    try:
        username = data.get('username', '')
        is_typing = data.get('is_typing', False)
        
        if username:
            emit('user_typing', {
                'username': username,
                'is_typing': is_typing,
                'user_id': request.sid
            }, broadcast=True, include_self=False)
    except Exception as e:
        print(f'Error handling typing: {e}')

@socketio.on('leave')
def handle_leave(data):
    """Handle user leaving chat"""
    user_id = request.sid
    if user_id in active_users:
        username = active_users[user_id]['username']
        del active_users[user_id]
        
        emit('user_left', {
            'username': username,
            'user_id': user_id,
            'timestamp': datetime.now().strftime('%H:%M:%S')
        }, broadcast=True)
        
        emit('update_users', {
            'users': [user['username'] for user in active_users.values()],
            'count': len(active_users)
        }, broadcast=True)

# Production startup
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    print(f"🚀 Starting Chat Nest server on port {port}")
    print(f"📡 Debug mode: {debug}")
    print(f"🔗 Server ready: http://0.0.0.0:{port}")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=debug,
        log_output=True,
        allow_unsafe_werkzeug=False  # Safe for production
    )
