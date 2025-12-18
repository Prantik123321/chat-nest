document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        nameModal: document.getElementById('nameModal'),
        usernameInput: document.getElementById('usernameInput'),
        usernameError: document.getElementById('usernameError'),
        joinChatBtn: document.getElementById('joinChatBtn'),
        connectionStatus: document.getElementById('connectionStatus'),
        container: document.querySelector('.container'),
        currentUser: document.getElementById('currentUser'),
        sidebarUsername: document.getElementById('sidebarUsername'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        messagesContainer: document.getElementById('messagesContainer'),
        userList: document.getElementById('userList'),
        onlineCount: document.getElementById('onlineCount'),
        userCount: document.getElementById('userCount'),
        typingIndicator: document.getElementById('typingIndicator'),
        photoBtn: document.getElementById('photoBtn'),
        photoInput: document.getElementById('photoInput'),
        emojiBtn: document.getElementById('emojiBtn'),
        emojiPicker: document.getElementById('emojiPicker'),
        closeEmojiBtn: document.getElementById('closeEmojiBtn'),
        gifBtn: document.getElementById('gifBtn'),
        clearBtn: document.getElementById('clearBtn'),
        leaveChatBtn: document.getElementById('leaveChatBtn'),
        sidebarLeaveBtn: document.getElementById('sidebarLeaveBtn'),
        photoModal: document.getElementById('photoModal'),
        viewedPhoto: document.getElementById('viewedPhoto'),
        closePhoto: document.querySelector('.close-photo'),
        closePhotoBtn: document.getElementById('closePhotoBtn'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        resetZoomBtn: document.getElementById('resetZoomBtn'),
        downloadPhotoBtn: document.getElementById('downloadPhotoBtn'),
        photoInfo: document.getElementById('photoInfo'),
        uploadProgress: document.getElementById('uploadProgress'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        emojiGrid: document.getElementById('emojiGrid'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileToggleBtn: document.getElementById('mobileToggleBtn'),
        notificationSound: document.getElementById('notificationSound'),
        currentTime: document.getElementById('currentTime')
    };

    // State variables
    const state = {
        currentUser: '',
        socket: null,
        typingTimeout: null,
        isTyping: false,
        currentZoom: 1,
        currentPhotoData: null,
        isConnected: false,
        emojiCategories: {
            all: ['😀', '😁', '😂', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁'],
            smileys: ['😀', '😁', '😂', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩'],
            people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎'],
            nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤'],
            food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥨', '🥯', '🥖', '🧀', '🥗', '🥙'],
            activity: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳']
        }
    };

    // Initialize
    function init() {
        updateCurrentTime();
        setInterval(updateCurrentTime, 60000); // Update every minute
        
        setupEventListeners();
        initEmojiPicker();
        
        // Try to connect immediately
        connectSocket();
    }

    function updateCurrentTime() {
        if (elements.currentTime) {
            const now = new Date();
            elements.currentTime.textContent = now.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
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
        elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        elements.messageInput.addEventListener('input', handleTyping);

        // Photo handling
        elements.photoBtn.addEventListener('click', () => elements.photoInput.click());
        elements.photoInput.addEventListener('change', handlePhotoUpload);

        // Emoji picker
        elements.emojiBtn.addEventListener('click', toggleEmojiPicker);
        elements.closeEmojiBtn.addEventListener('click', () => {
            elements.emojiPicker.style.display = 'none';
        });

        // GIF button
        elements.gifBtn.addEventListener('click', () => {
            const gifUrl = prompt('Enter GIF URL (supports .gif, .jpg, .png):');
            if (gifUrl && isValidImageUrl(gifUrl)) {
                sendMessage(gifUrl, 'photo');
            } else if (gifUrl) {
                showError('Please enter a valid image URL (gif, jpg, png)');
            }
        });

        // Clear button
        elements.clearBtn.addEventListener('click', () => {
            elements.messageInput.value = '';
            elements.messageInput.focus();
        });

        // Leave chat
        elements.leaveChatBtn.addEventListener('click', leaveChat);
        elements.sidebarLeaveBtn.addEventListener('click', leaveChat);

        // Photo modal
        elements.closePhoto.addEventListener('click', closePhotoModal);
        elements.closePhotoBtn.addEventListener('click', closePhotoModal);
        elements.zoomInBtn.addEventListener('click', () => zoomPhoto(0.2));
        elements.zoomOutBtn.addEventListener('click', () => zoomPhoto(-0.2));
        elements.resetZoomBtn.addEventListener('click', resetPhotoZoom);
        elements.downloadPhotoBtn.addEventListener('click', downloadPhoto);

        // Mobile menu
        elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        elements.mobileToggleBtn.addEventListener('click', toggleMobileMenu);

        // Auto-resize textarea
        elements.messageInput.addEventListener('input', autoResizeTextarea);

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target === elements.emojiPicker) {
                elements.emojiPicker.style.display = 'none';
            }
            if (e.target === elements.photoModal) {
                closePhotoModal();
            }
        });

        // Prevent accidental refresh/close
        window.addEventListener('beforeunload', (e) => {
            if (state.socket && state.socket.connected) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to leave? Your chat session will end.';
            }
        });

        // Handle window resize
        window.addEventListener('resize', handleResize);
    }

    function initEmojiPicker() {
        // Populate emojis
        Object.keys(state.emojiCategories).forEach(category => {
            const btn = document.querySelector(`.emoji-category[data-category="${category}"]`);
            if (btn) {
                btn.addEventListener('click', () => filterEmojis(category));
            }
        });

        // Show all emojis initially
        filterEmojis('all');
    }

    function filterEmojis(category) {
        elements.emojiGrid.innerHTML = '';
        const emojis = category === 'all' 
            ? Object.values(state.emojiCategories).flat()
            : state.emojiCategories[category];
        
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.textContent = emoji;
            span.title = `Emoji: ${emoji}`;
            span.onclick = () => {
                insertAtCursor(emoji);
                elements.messageInput.focus();
            };
            elements.emojiGrid.appendChild(span);
        });

        // Update active category button
        document.querySelectorAll('.emoji-category').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.emoji-category[data-category="${category}"]`)?.classList.add('active');
    }

    function insertAtCursor(text) {
        const input = elements.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        
        input.value = input.value.substring(0, start) + text + input.value.substring(end);
        input.selectionStart = input.selectionEnd = start + text.length;
        
        // Trigger input event for auto-resize
        input.dispatchEvent(new Event('input'));
    }

    function connectSocket() {
        if (state.socket && state.socket.connected) return;

        // Connect to Socket.IO server
        state.socket = io({
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });

        // Socket event handlers
        state.socket.on('connect', () => {
            state.isConnected = true;
            updateConnectionStatus('Connected', 'success');
            elements.joinChatBtn.disabled = false;
        });

        state.socket.on('disconnect', () => {
            state.isConnected = false;
            updateConnectionStatus('Disconnected', 'error');
            elements.joinChatBtn.disabled = true;
        });

        state.socket.on('connect_error', () => {
            updateConnectionStatus('Connection failed', 'error');
        });

        state.socket.on('connection_response', (data) => {
            console.log('Server response:', data);
        });

        state.socket.on('join_error', (data) => {
            showError(data.error || 'Failed to join chat');
        });

        state.socket.on('join_success', (data) => {
            console.log('Joined successfully:', data);
        });

        state.socket.on('user_joined', (data) => {
            addSystemMessage(`${data.username} joined the chat`, data.timestamp);
            if (state.currentUser !== data.username) {
                playNotificationSound();
            }
        });

        state.socket.on('user_left', (data) => {
            addSystemMessage(`${data.username} left the chat`, data.timestamp);
        });

        state.socket.on('update_users', (users) => {
            updateUserList(users);
        });

        state.socket.on('new_message', (data) => {
            addMessage(data);
            if (data.username !== state.currentUser) {
                playNotificationSound();
            }
        });

        state.socket.on('message_history', (messages) => {
            messages.forEach(msg => addMessage(msg));
        });

        state.socket.on('user_typing', (data) => {
            showTypingIndicator(data);
        });
    }

    function updateConnectionStatus(text, type) {
        if (!elements.connectionStatus) return;
        
        elements.connectionStatus.textContent = text;
        elements.connectionStatus.className = 'connection-status';
        
        if (type === 'success') {
            elements.connectionStatus.style.color = 'var(--success)';
        } else if (type === 'error') {
            elements.connectionStatus.style.color = 'var(--danger)';
        }
    }

    function joinChat() {
        const username = elements.usernameInput.value.trim();
        
        // Validate username
        if (username.length < 2 || username.length > 20) {
            showError('Username must be 2-20 characters');
            return;
        }
        
        if (!/^[a-zA-Z0-9_\s]+$/.test(username)) {
            showError('Username can only contain letters, numbers, spaces, and underscores');
            return;
        }
        
        // Ensure socket is connected
        if (!state.socket || !state.socket.connected) {
            showError('Not connected to server. Please try again.');
            connectSocket();
            return;
        }
        
        state.currentUser = username;
        elements.currentUser.textContent = username;
        elements.sidebarUsername.textContent = username;
        
        // Join the chat
        state.socket.emit('join', { username: username });
        
        // Hide modal and show chat
        elements.nameModal.style.display = 'none';
        elements.container.style.display = 'flex';
        elements.messageInput.focus();
        
        // Add welcome message
        setTimeout(() => {
            addSystemMessage(`Welcome ${username}! Start chatting with everyone.`, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 500);
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
            autoResizeTextarea();
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
        
        autoResizeTextarea();
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
            showError('Please select an image file (jpg, png, gif)');
            return;
        }
        
        if (file.size > 16 * 1024 * 1024) { // 16MB limit
            showError('Image size should be less than 16MB');
            return;
        }
        
        showUploadProgress(0);
        
        const reader = new FileReader();
        reader.onloadstart = () => {
            showUploadProgress(10);
        };
        
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                showUploadProgress(percent);
            }
        };
        
        reader.onload = function(e) {
            showUploadProgress(90);
            
            // Save photo to server
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
                    showError(data.error || 'Failed to upload photo');
                }
            })
            .catch(error => {
                hideUploadProgress();
                showError('Upload failed: ' + error.message);
            });
        };
        
        reader.onerror = () => {
            hideUploadProgress();
            showError('Failed to read file');
        };
        
        reader.readAsDataURL(file);
        
        // Reset file input
        elements.photoInput.value = '';
    }

    function showUploadProgress(percent) {
        elements.uploadProgress.style.display = 'block';
        elements.progressFill.style.width = percent + '%';
        elements.progressText.textContent = percent === 100 ? 'Upload Complete!' : `Uploading... ${percent}%`;
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
        messageDiv.dataset.messageId = data.id;
        
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span>${data.username} ${data.username === state.currentUser ? '(You)' : ''}</span>
            <span>${data.timestamp}</span>
        `;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        if (data.type === 'photo' || data.type === 'gif') {
            const img = document.createElement('img');
            const imageUrl = data.photo_url || data.message;
            img.src = imageUrl;
            img.className = 'message-photo';
            img.alt = `Shared by ${data.username}`;
            img.loading = 'lazy';
            img.onclick = () => viewPhoto(imageUrl, data.username, data.timestamp);
            img.onerror = () => {
                img.src = 'https://via.placeholder.com/300x200?text=Image+Failed+to+Load';
                img.onclick = null;
            };
            content.appendChild(img);
            
            if (data.type === 'gif') {
                const badge = document.createElement('span');
                badge.textContent = 'GIF';
                badge.style.cssText = `
                    display: inline-block;
                    background: var(--warning);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    margin-left: 8px;
                    vertical-align: middle;
                `;
                header.querySelector('span:first-child').appendChild(badge);
            }
        } else {
            // Process text for emojis and links
            let processedText = data.message;
            
            // Convert URLs to links
            processedText = processedText.replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            );
            
            content.innerHTML = processedText;
        }
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(content);
        elements.messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom with smooth animation
        setTimeout(() => {
            elements.messagesContainer.scrollTo({
                top: elements.messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }

    function addSystemMessage(text, timestamp) {
        const systemDiv = document.createElement('div');
        systemDiv.className = 'message system-message';
        systemDiv.innerHTML = `
            <div class="message-header">
                <span><i class="fas fa-info-circle"></i> System</span>
                <span>${timestamp}</span>
            </div>
            <div class="message-content">${text}</div>
        `;
        
        elements.messagesContainer.appendChild(systemDiv);
        
        setTimeout(() => {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }, 100);
    }

    function updateUserList(users) {
        elements.userList.innerHTML = '';
        elements.onlineCount.textContent = users.length;
        elements.userCount.textContent = users.length;
        
        if (users.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No users online';
            li.style.opacity = '0.7';
            li.style.fontStyle = 'italic';
            elements.userList.appendChild(li);
            return;
        }
        
        // Sort users alphabetically
        users.sort((a, b) => a.username.localeCompare(b.username));
        
        users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${user.username}</span>
                <small style="margin-left: auto; opacity: 0.7;">joined ${user.joined_at}</small>
            `;
            elements.userList.appendChild(li);
        });
    }

    function showTypingIndicator(data) {
        if (data.is_typing && data.username !== state.currentUser) {
            elements.typingIndicator.textContent = `${data.username} is typing...`;
            elements.typingIndicator.style.display = 'flex';
        } else {
            elements.typingIndicator.style.display = 'none';
        }
    }

    function toggleEmojiPicker() {
        const isVisible = elements.emojiPicker.style.display === 'block';
        elements.emojiPicker.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Position picker above input
            const rect = elements.emojiBtn.getBoundingClientRect();
            elements.emojiPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
            elements.emojiPicker.style.right = `${window.innerWidth - rect.right}px`;
        }
    }

    function viewPhoto(photoUrl, username, timestamp) {
        state.currentPhotoData = photoUrl;
        elements.viewedPhoto.src = photoUrl;
        elements.photoInfo.textContent = `Shared by ${username} at ${timestamp}`;
        elements.photoModal.style.display = 'flex';
        resetPhotoZoom();
        
        // Add drag functionality
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;
        
        elements.viewedPhoto.addEventListener('mousedown', startDrag);
        elements.viewedPhoto.addEventListener('touchstart', startDrag);
        
        function startDrag(e) {
            isDragging = true;
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            startX = clientX - translateX;
            startY = clientY - translateY;
            e.preventDefault();
        }
        
        function doDrag(e) {
            if (!isDragging) return;
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            translateX = clientX - startX;
            translateY = clientY - startY;
            elements.viewedPhoto.style.transform = `scale(${state.currentZoom}) translate(${translateX}px, ${translateY}px)`;
        }
        
        function stopDrag() {
            isDragging = false;
        }
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('touchmove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
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
        link.download = `chatnest_${Date.now()}.${state.currentPhotoData.includes('.gif') ? 'gif' : 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function leaveChat() {
        if (confirm('Are you sure you want to leave the chat?')) {
            if (state.socket) {
                state.socket.disconnect();
            }
            
            elements.container.style.display = 'none';
            elements.nameModal.style.display = 'flex';
            elements.usernameInput.value = '';
            elements.usernameInput.focus();
            elements.messagesContainer.innerHTML = '';
            elements.userList.innerHTML = '';
            state.currentUser = '';
            
            // Add welcome message back
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'message system-message';
            welcomeMsg.innerHTML = `
                <div class="message-header">
                    <span><i class="fas fa-info-circle"></i> System</span>
                    <span id="currentTime"></span>
                </div>
                <div class="message-content">
                    Welcome to Chat Nest! Type a message below to start chatting.
                </div>
            `;
            elements.messagesContainer.appendChild(welcomeMsg);
            updateCurrentTime();
        }
    }

    function toggleMobileMenu() {
        document.querySelector('.sidebar').classList.toggle('active');
    }

    function autoResizeTextarea() {
        const textarea = elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    function handleResize() {
        if (window.innerWidth <= 1024) {
            document.querySelector('.sidebar').classList.remove('active');
        }
        autoResizeTextarea();
    }

    function playNotificationSound() {
        if (elements.notificationSound) {
            elements.notificationSound.currentTime = 0;
            elements.notificationSound.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    function showError(message) {
        // Show in username error area if modal is visible
        if (elements.nameModal.style.display !== 'none' && elements.usernameError) {
            elements.usernameError.textContent = message;
            elements.usernameError.classList.add('show');
            setTimeout(() => {
                elements.usernameError.classList.remove('show');
            }, 3000);
        } else {
            // Show temporary alert
            const alert = document.createElement('div');
            alert.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--danger);
                color: white;
                padding: 12px 24px;
                border-radius: var(--radius);
                box-shadow: var(--shadow-lg);
                z-index: 3000;
                animation: slideInRight 0.3s ease;
                max-width: 300px;
                word-wrap: break-word;
            `;
            alert.textContent = message;
            document.body.appendChild(alert);
            
            setTimeout(() => {
                alert.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    document.body.removeChild(alert);
                }, 300);
            }, 3000);
        }
    }

    function isValidImageUrl(url) {
        return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url) || 
               url.startsWith('data:image') ||
               url.includes('imgur') ||
               url.includes('giphy');
    }

    // Initialize the application
    init();
});
