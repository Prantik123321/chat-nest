from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
import os
from datetime import datetime
import base64
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'chatnest-secret-key-2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active users and messages
active_users = {}
chat_messages = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/save_photo', methods=['POST'])
def save_photo():
    try:
        data = request.json
        photo_data = data['photo'].split(',')[1]
        photo_name = f"photo_{uuid.uuid4().hex[:8]}.png"
        
        # In production, save to database or file system
        # Here we just return the base64 data
        return jsonify({
            'success': True,
            'photo_url': data['photo'],
            'photo_name': photo_name
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    user_id = request.sid
    if user_id in active_users:
        username = active_users[user_id]
        del active_users[user_id]
        emit('user_left', {'username': username, 'timestamp': datetime.now().strftime('%H:%M:%S')}, broadcast=True)
        emit('update_users', list(active_users.values()), broadcast=True)

@socketio.on('join')
def handle_join(data):
    username = data['username']
    user_id = request.sid
    active_users[user_id] = username
    
    join_room('main_room')
    
    emit('user_joined', {
        'username': username,
        'timestamp': datetime.now().strftime('%H:%M:%S')
    }, broadcast=True)
    
    emit('update_users', list(active_users.values()), broadcast=True)
    
    # Send last 50 messages to new user
    emit('message_history', chat_messages[-50:])

@socketio.on('send_message')
def handle_message(data):
    message_id = str(uuid.uuid4())
    message_data = {
        'id': message_id,
        'username': data['username'],
        'message': data['message'],
        'timestamp': datetime.now().strftime('%H:%M %p'),
        'type': data.get('type', 'text'),
        'photo_url': data.get('photo_url', '')
    }
    
    chat_messages.append(message_data)
    if len(chat_messages) > 1000:
        chat_messages.pop(0)
    
    emit('new_message', message_data, broadcast=True)

@socketio.on('typing')
def handle_typing(data):
    emit('user_typing', {
        'username': data['username'],
        'is_typing': data['is_typing']
    }, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)