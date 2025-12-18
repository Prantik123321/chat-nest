document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        nameModal: document.getElementById('nameModal'),
        usernameInput: document.getElementById('usernameInput'),
        usernameError: document.getElementById('usernameError'),
        joinChatBtn: document.getElementById('joinChatBtn'),
        container: document.querySelector('.container'),
        currentUser: document.getElementById('currentUser'),
        sidebarUsername: document.getElementById('sidebarUsername'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        messagesContainer: document.getElementById('messagesContainer'),
        userList: document.getElementById('userList'),
        onlineCount: document.getElementById('onlineCount'),
        typingIndicator: document.getElementById('typingIndicator'),
        photoBtn: document.getElementById('photoBtn'),
        photoInput: document.getElementById('photoInput'),
        emojiBtn: document.getElementById('emojiBtn'),
        emojiPicker: document.getElementById('emojiPicker'),
        closeEmojiBtn: document.getElementById('closeEmojiBtn'),
        gifBtn: document.getElementById('gifBtn'),
        leaveChatBtn: document.getElementById('leaveChatBtn'),
        photoModal: document.getElementById('photoModal'),
        viewedPhoto: document.getElementById('viewedPhoto'),
        closePhoto: document.querySelector('.close-photo'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        resetZoomBtn: document.getElementById('resetZoomBtn'),
        downloadPhotoBtn: document.getElementById('downloadPhotoBtn'),
        photoInfo: document.getElementById('photoInfo'),
        uploadProgress: document.getElementById('uploadProgress'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        emojiGrid: document.getElementById('emojiGrid')
    };

    // State
    const state = {
        currentUser: '',
        socket: null,
        typingTimeout: null,
        isTyping: false,
        currentZoom: 1,
        currentPhotoData: null,
        isConnected: false
    };

    // Common emojis
    const emojis = ['😀', '😁', '😂', '😃', '😄', '😅', '😆', '😉', '😊', '😋', 
                   '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩',
                   '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮',
                   '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝',
                   '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁',
                   '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩',
                   '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '🥴',
                   '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇'];

    // Initialize
    function init() {
        setupEventListeners();
        initEmojiPicker();
        connectSocket();
        
        // Add mobile toggle button
        if (window.innerWidth <= 768) {
            addMobileToggle();
        }
    }

    function setupEventListeners() {
        // Join chat
        elements.joinChatBtn.addEventListener('click', joinChat);
        elements.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') joinChat();
        });

        // Send message
        elements.sendBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        elements.messageInput.addEventListener('input', handleTyping);

        // Photo upload
        elements.photoBtn.addEventListener('click', () => elements.photoInput.click());
        elements.photoInput.addEventListener('change', handlePhotoUpload);

        // Emoji picker
        elements.emojiBtn.addEventListener('click', toggleEmojiPicker);
        elements.closeEmojiBtn.addEventListener('click', () => {
            elements.emojiPicker.style.display = 'none';
        });

        // GIF button
        elements.gifBtn.addEventListener('click', () => {
            const gifUrl = prompt('Enter GIF URL:');
            if (gifUrl) {
                sendMessage(gifUrl, 'photo');
            }
        });

        // Leave chat
        elements.leaveChatBtn.addEventListener('click', leaveChat);

        // Photo modal
        elements.closePhoto.addEventListener('click', closePhotoModal);
        elements.zoomInBtn.addEventListener('click', () => zoomPhoto(0.2));
        elements.zoomOutBtn.addEventListener('click', () => zoomPhoto(-0.2));
        elements.resetZoomBtn.addEventListener('click', resetPhotoZoom);
        elements.downloadPhotoBtn.addEventListener('click', downloadPhoto);

        // Window events
        window.addEventListener('click', (e) => {
            if (e.target === elements.emojiPicker) {
                elements.emojiPicker.style.display = 'none';
            }
            if (e.target === elements.photoModal) {
                closePhotoModal();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                addMobileToggle();
            }
        });
    }

    function addMobileToggle() {
        if (!document.querySelector('.mobile-toggle')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'mobile-toggle';
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
            toggleBtn.onclick = toggleMobileMenu;
            document.body.appendChild(toggleBtn);
        }
    }

    function toggleMobileMenu() {
        document.querySelector('.sidebar').classList.toggle('active');
    }

    function initEmojiPicker() {
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.textContent = emoji;
            span.onclick = () => {
                elements.messageInput.value += emoji;
                elements.messageInput.focus();
            };
            elements.emojiGrid.appendChild(span);
        });
    }

    function toggleEmojiPicker() {
        elements.emojiPicker.style.display = 
            elements.emojiPicker.style.display === 'block' ? 'none' : 'block';
    }

    function connectSocket() {
        state.socket = io();

        state.socket.on('connect', () => {
            state.isConnected = true;
            console.log('Connected to server');
        });

        state.socket.on('disconnect', () => {
            state.isConnected = false;
            console.log('Disconnected from server');
        });

        state.socket.on('join_error', (data) => {
            showError(data.error || 'Failed to join chat');
        });

        state.socket.on('user_joined', (data) => {
            addSystemMessage(`${data.username} joined the chat`);
        });

        state.socket.on('user_left', (data) => {
            addSystemMessage(`${data.username} left the chat`);
        });

        state.socket.on('update_users', (users) => {
            updateUserList(users);
        });

        state.socket.on('new_message', (data) => {
            addMessage(data);
        });

        state.socket.on('message_history', (messages) => {
            messages.forEach(msg => addMessage(msg));
        });

        state.socket.on('user_typing', (data) => {
            showTypingIndicator(data);
        });
    }

    function joinChat() {
        const username = elements.usernameInput.value.trim();
        
        if (username.length < 2 || username.length > 20) {
            showError('Username must be 2-20 characters');
            return;
        }
        
        if (!state.socket || !state.socket.connected) {
            showError('Not connected to server');
            return;
        }
        
        state.currentUser = username;
        elements.currentUser.textContent = username;
        elements.sidebarUsername.textContent = username;
        
        state.socket.emit('join', { username: username });
        
        elements.nameModal.style.display = 'none';
        elements.container.style.display = 'flex';
        elements.messageInput.focus();
    }

    function sendMessage(content = null, type = 'text') {
        const message = content || elements.messageInput.value.trim();
        
        if (!message && type === 'text') {
            showError('Please enter a message');
            return;
        }
        
        if (!state.socket || !state.socket.connected) {
            showError('Not connected to server');
            return;
        }
        
        const messageData = {
            message: message,
            type: type
        };
        
        state.socket.emit('send_message', messageData);
        
        if (type === 'text') {
            elements.messageInput.value = '';
            elements.messageInput.style.height = 'auto';
            stopTyping();
        }
    }

    function handleTyping() {
        if (!state.isTyping) {
            state.isTyping = true;
            state.socket.emit('typing', { is_typing: true });
        }
        
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            state.isTyping = false;
            state.socket.emit('typing', { is_typing: false });
        }, 1000);
    }

    function stopTyping() {
        if (state.isTyping) {
            state.isTyping = false;
            state.socket.emit('typing', { is_typing: false });
        }
        clearTimeout(state.typingTimeout);
    }

    function handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            showError('Please select an image file');
            return;
        }
        
        if (file.size > 16 * 1024 * 1024) {
            showError('Image size should be less than 16MB');
            return;
        }
        
        showUploadProgress(0);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            showUploadProgress(50);
            
            fetch('/api/save_photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ photo: e.target.result })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showUploadProgress(100);
                    setTimeout(() => {
                        hideUploadProgress();
                        sendMessage(data.photo_url, 'photo');
                    }, 500);
                } else {
                    hideUploadProgress();
                    showError(data.error || 'Upload failed');
                }
            })
            .catch(error => {
                hideUploadProgress();
                showError('Upload failed');
            });
        };
        
        reader.onerror = () => {
            hideUploadProgress();
            showError('Failed to read file');
        };
        
        reader.readAsDataURL(file);
        elements.photoInput.value = '';
    }

    function showUploadProgress(percent) {
        elements.uploadProgress.style.display = 'block';
        elements.progressFill.style.width = percent + '%';
        elements.progressText.textContent = `Uploading... ${percent}%`;
    }

    function hideUploadProgress() {
        setTimeout(() => {
            elements.uploadProgress.style.display = 'none';
            elements.progressFill.style.width = '0%';
        }, 1000);
    }

    function addMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.username === state.currentUser ? 'own-message' : 'other-message'}`;
        
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
            img.onerror = () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzFhMmEzYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4Ij5JbWFnZSBGYWlsZWQgdG8gTG9hZDwvdGV4dD48L3N2Zz4=';
            };
            content.appendChild(img);
        } else {
            // Convert URLs to links
            let text = data.message;
            text = text.replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>'
            );
            content.innerHTML = text;
        }
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(content);
        elements.messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    function addSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'system-message';
        div.innerHTML = `<p>${text}</p>`;
        elements.messagesContainer.appendChild(div);
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    function updateUserList(users) {
        elements.userList.innerHTML = '';
        elements.onlineCount.textContent = users.length;
        
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user.username;
            elements.userList.appendChild(li);
        });
    }

    function showTypingIndicator(data) {
        if (data.is_typing && data.username !== state.currentUser) {
            elements.typingIndicator.textContent = `${data.username} is typing...`;
        } else {
            elements.typingIndicator.textContent = '';
        }
    }

    function viewPhoto(photoUrl, username, timestamp) {
        state.currentPhotoData = photoUrl;
        elements.viewedPhoto.src = photoUrl;
        elements.photoInfo.textContent = `Shared by ${username} at ${timestamp}`;
        elements.photoModal.style.display = 'flex';
        resetPhotoZoom();
    }

    function closePhotoModal() {
        elements.photoModal.style.display = 'none';
        resetPhotoZoom();
    }

    function zoomPhoto(delta) {
        state.currentZoom = Math.max(0.1, Math.min(5, state.currentZoom + delta));
        elements.viewedPhoto.style.transform = `scale(${state.currentZoom})`;
    }

    function resetPhotoZoom() {
        state.currentZoom = 1;
        elements.viewedPhoto.style.transform = `scale(${state.currentZoom})`;
    }

    function downloadPhoto() {
        if (!state.currentPhotoData) return;
        
        const link = document.createElement('a');
        link.href = state.currentPhotoData;
        link.download = `chatnest_photo_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function leaveChat() {
        if (confirm('Leave chat?')) {
            if (state.socket) {
                state.socket.disconnect();
            }
            
            elements.container.style.display = 'none';
            elements.nameModal.style.display = 'flex';
            elements.usernameInput.value = '';
            elements.usernameInput.focus();
            elements.messagesContainer.innerHTML = `
                <div class="system-message">
                    <p>Welcome to Chat Nest! Start chatting below.</p>
                </div>
            `;
            elements.userList.innerHTML = '';
            state.currentUser = '';
        }
    }

    function showError(message) {
        elements.usernameError.textContent = message;
        elements.usernameError.style.display = 'block';
        setTimeout(() => {
            elements.usernameError.style.display = 'none';
        }, 3000);
    }

    // Initialize app
    init();
});