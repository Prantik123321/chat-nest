document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const nameModal = document.getElementById('nameModal');
    const usernameInput = document.getElementById('usernameInput');
    const joinChatBtn = document.getElementById('joinChatBtn');
    const container = document.querySelector('.container');
    const currentUserSpan = document.getElementById('currentUser');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const messagesContainer = document.getElementById('messagesContainer');
    const userList = document.getElementById('userList');
    const onlineCount = document.getElementById('onlineCount');
    const typingIndicator = document.getElementById('typingIndicator');
    const photoBtn = document.getElementById('photoBtn');
    const photoInput = document.getElementById('photoInput');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const closeEmojiBtn = document.getElementById('closeEmojiBtn');
    const gifBtn = document.getElementById('gifBtn');
    const leaveChatBtn = document.getElementById('leaveChatBtn');
    const photoModal = document.getElementById('photoModal');
    const viewedPhoto = document.getElementById('viewedPhoto');
    const closePhoto = document.querySelector('.close-photo');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetZoomBtn = document.getElementById('resetZoomBtn');
    const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
    const photoInfo = document.getElementById('photoInfo');

    // Variables
    let currentUser = '';
    let socket = null;
    let typingTimeout = null;
    let isTyping = false;
    let currentZoom = 1;
    let currentPhotoData = null;

    // Common emojis
    const emojis = ['😀', '😁', '😂', '😃', '😄', '😅', '😆', '😉', '😊', '😋', 
                   '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩',
                   '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮',
                   '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝',
                   '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁',
                   '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩',
                   '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '🥴',
                   '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇',
                   '🥳', '🥸', '🥺', '🤠', '🤡', '💩', '👻', '💀', '☠️', '👽',
                   '👾', '🤖', '🎃', '😈', '👿', '👹', '👺', '🤚', '✋', '🖖'];

    // Initialize emoji picker
    const emojiGrid = emojiPicker.querySelector('.emoji-grid');
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.onclick = () => {
            messageInput.value += emoji;
            messageInput.focus();
        };
        emojiGrid.appendChild(span);
    });

    // Event Listeners
    joinChatBtn.addEventListener('click', joinChat);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinChat();
    });

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', handleTyping);

    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoUpload);

    emojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = 'block';
    });

    closeEmojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = 'none';
    });

    gifBtn.addEventListener('click', () => {
        const gifUrl = prompt('Enter GIF URL:');
        if (gifUrl) {
            sendMessage(gifUrl, 'gif');
        }
    });

    leaveChatBtn.addEventListener('click', leaveChat);

    closePhoto.addEventListener('click', () => {
        photoModal.style.display = 'none';
        resetZoom();
    });

    zoomInBtn.addEventListener('click', () => {
        currentZoom += 0.2;
        updatePhotoZoom();
    });

    zoomOutBtn.addEventListener('click', () => {
        if (currentZoom > 0.2) {
            currentZoom -= 0.2;
            updatePhotoZoom();
        }
    });

    resetZoomBtn.addEventListener('click', resetZoom);

    downloadPhotoBtn.addEventListener('click', downloadPhoto);

    // Functions
    function joinChat() {
        const username = usernameInput.value.trim();
        if (username.length < 2) {
            alert('Please enter a name (at least 2 characters)');
            return;
        }

        currentUser = username;
        currentUserSpan.textContent = username;

        // Connect to Socket.IO
        socket = io();

        socket.on('connect', () => {
            socket.emit('join', { username: currentUser });
        });

        socket.on('user_joined', (data) => {
            addSystemMessage(`${data.username} joined the chat`, data.timestamp);
        });

        socket.on('user_left', (data) => {
            addSystemMessage(`${data.username} left the chat`, data.timestamp);
        });

        socket.on('update_users', (users) => {
            updateUserList(users);
        });

        socket.on('new_message', (data) => {
            addMessage(data);
        });

        socket.on('message_history', (messages) => {
            messages.forEach(msg => addMessage(msg));
        });

        socket.on('user_typing', (data) => {
            showTypingIndicator(data);
        });

        // Hide modal and show chat
        nameModal.style.display = 'none';
        container.style.display = 'flex';
        messageInput.focus();
    }

    function sendMessage(content = null, type = 'text') {
        const message = content || messageInput.value.trim();
        if (!message && type === 'text') return;

        if (socket) {
            const messageData = {
                username: currentUser,
                message: message,
                type: type
            };

            socket.emit('send_message', messageData);
        }

        if (type === 'text') {
            messageInput.value = '';
            stopTyping();
        }
    }

    function handleTyping() {
        if (!isTyping) {
            isTyping = true;
            socket.emit('typing', { username: currentUser, is_typing: true });
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isTyping = false;
            socket.emit('typing', { username: currentUser, is_typing: false });
        }, 1000);
    }

    function stopTyping() {
        if (isTyping) {
            isTyping = false;
            socket.emit('typing', { username: currentUser, is_typing: false });
        }
        clearTimeout(typingTimeout);
    }

    function handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image size should be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const photoData = e.target.result;
            
            // Save photo to server
            fetch('/save_photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ photo: photoData })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    sendMessage(data.photo_url, 'photo');
                }
            });
        };
        reader.readAsDataURL(file);
        
        // Reset file input
        photoInput.value = '';
    }

    function addMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.username === currentUser ? 'own-message' : 'other-message'}`;
        
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span>${data.username}</span>
            <span>${data.timestamp}</span>
        `;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        if (data.type === 'photo') {
            const img = document.createElement('img');
            img.src = data.photo_url || data.message;
            img.className = 'message-photo';
            img.alt = 'Shared photo';
            img.onclick = () => viewPhoto(data.photo_url || data.message, data.username, data.timestamp);
            content.appendChild(img);
        } else if (data.type === 'gif') {
            const img = document.createElement('img');
            img.src = data.message;
            img.className = 'message-photo';
            img.alt = 'Shared GIF';
            img.onclick = () => viewPhoto(data.message, data.username, data.timestamp);
            content.appendChild(img);
        } else {
            content.textContent = data.message;
        }
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function addSystemMessage(text, timestamp) {
        const systemDiv = document.createElement('div');
        systemDiv.className = 'message system-message';
        systemDiv.style.cssText = `
            background: var(--light-gray);
            color: var(--gray);
            text-align: center;
            max-width: 100%;
            font-size: 0.9rem;
            padding: 0.5rem 1rem;
        `;
        
        systemDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${text}</span>
                <span style="font-size: 0.8rem; opacity: 0.7;">${timestamp}</span>
            </div>
        `;
        
        messagesContainer.appendChild(systemDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function updateUserList(users) {
        userList.innerHTML = '';
        onlineCount.textContent = users.length;
        
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            userList.appendChild(li);
        });
    }

    function showTypingIndicator(data) {
        if (data.is_typing && data.username !== currentUser) {
            typingIndicator.textContent = `${data.username} is typing...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }

    function viewPhoto(photoUrl, username, timestamp) {
        viewedPhoto.src = photoUrl;
        currentPhotoData = photoUrl;
        photoInfo.textContent = `Shared by ${username} at ${timestamp}`;
        photoModal.style.display = 'flex';
        resetZoom();
    }

    function updatePhotoZoom() {
        viewedPhoto.style.transform = `scale(${currentZoom})`;
    }

    function resetZoom() {
        currentZoom = 1;
        updatePhotoZoom();
    }

    function downloadPhoto() {
        if (!currentPhotoData) return;
        
        const link = document.createElement('a');
        link.href = currentPhotoData;
        link.download = `chatnest_photo_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function leaveChat() {
        if (socket) {
            socket.disconnect();
        }
        
        container.style.display = 'none';
        nameModal.style.display = 'flex';
        usernameInput.value = '';
        usernameInput.focus();
        
        // Clear messages
        messagesContainer.innerHTML = '';
        userList.innerHTML = '';
        currentUser = '';
    }

    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target === emojiPicker) {
            emojiPicker.style.display = 'none';
        }
        if (event.target === photoModal) {
            photoModal.style.display = 'none';
            resetZoom();
        }
    };

    // Initialize
    usernameInput.focus();
});