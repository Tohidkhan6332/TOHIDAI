	  let activeNotification = null;

function showModelSwitchPrompt() {
	if (activeNotification) {
		activeNotification.remove();
	}

	const notification = document.createElement('div');
	notification.className = 'notification-item';
	notification.innerHTML = `
		<div class="notification-content">
			<p>🖼️ Image uploads are only supported with Default AI. Switch model?</p>
			<button onclick="switchToDefaultModel()">
				Switch to Default AI
			</button>
		</div>
	`;
	
	const notificationList = document.querySelector('.notification-list');
	notificationList.prepend(notification);
	activeNotification = notification;
	const panel = document.getElementById('notificationPanel');
	panel.classList.add('active');
}

function switchToDefaultModel() {
	currentModel = {
		name: 'default',
		endpoint: 'https://ab-techiai.abrahamdw882.workers.dev/'
	};
	localStorage.setItem('selectedModel', JSON.stringify(currentModel));
	
	document.querySelectorAll('.model-item').forEach(i => i.classList.remove('active'));
	document.querySelector('[data-model="default"]').classList.add('active');
	if (activeNotification) {
		activeNotification.remove();
		activeNotification = null;
	}
	uploadedImages = [];
	document.getElementById('imagePreviews').innerHTML = '';
}
let currentModel = {
	name: 'default',
	endpoint: 'https://ab-techiai.abrahamdw882.workers.dev/'
};
let voiceModalOpen = false;
let recognitionActive = false;
let recognition;
let resultReceived = false; 

document.getElementById('voiceAssistantBtn').addEventListener('click', () => {
  document.getElementById('voiceModal').style.display = 'flex';
  voiceModalOpen = true;
  updateVoiceStatus('initial');
});

function closeVoiceModal() {
  document.getElementById('voiceModal').style.display = 'none';
  voiceModalOpen = false;
  if (recognitionActive) {
	recognition.stop();
  }
}

function initializeVoiceAssistant() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
	recognitionActive = true;
	resultReceived = false;
	updateVoiceStatus('listening');
  };

  recognition.onend = () => {
	recognitionActive = false;
	if (!resultReceived) {
	  updateVoiceStatus('error', 'Couldn\'t hear you, please try again');
	}
  };

  recognition.onresult = async (event) => {
	resultReceived = true;
	const transcript = event.results[0][0].transcript.trim();
	await processVoiceQuery(transcript);
  };

  recognition.onerror = (event) => {
	console.error('Recognition error:', event.error);
	updateVoiceStatus('error', `Error: ${event.error}`);
  };

  document.getElementById('micBtn').addEventListener('click', toggleRecognition);
}

async function toggleRecognition() {
  if (recognitionActive) {
	recognition.stop();
	updateVoiceStatus('ready');
  } else {
	try {
	  await recognition.start();
	} catch (err) {
	  updateVoiceStatus('error', 'Microphone access required');
	  alert('Please enable microphone access to use voice features');
	}
  }
}

async function processVoiceQuery(query) {
	try {
		updateVoiceStatus('processing');
		const aiResponse = await fetch("https://ab-techiai.abrahamdw882.workers.dev/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: [{ role: "user", content: query }] })
		});
		
		const aiData = await aiResponse.json();
		const responseText = aiData.choices[0].message.content;
		const ttsUrl = `https://ab-text-voice.abrahamdw882.workers.dev/?${new URLSearchParams({
			q: responseText,
			voicename: "jane"
		})}`;

		const ttsResponse = await fetch(ttsUrl);
		if (!ttsResponse.ok) throw new Error('TTS request failed');
		
		const ttsData = await ttsResponse.json();
		if (!ttsData.url) throw new Error('No audio URL returned');

		const audio = new Audio(ttsData.url);
		audio.type = 'audio/mpeg';
		
		audio.addEventListener('play', () => {
			document.getElementById('micBtn').classList.add('shaking');
			updateVoiceStatus('speaking');
		});
		
		audio.addEventListener('ended', () => {
			document.getElementById('micBtn').classList.remove('shaking');
			updateVoiceStatus('ready');
			setTimeout(() => {
				if (!recognitionActive) {
					recognition.start();
				}
			}, 500);
		});
		
		audio.addEventListener('error', () => {
			document.getElementById('micBtn').classList.remove('shaking');
			updateVoiceStatus('error', 'Audio playback failed');
		});
		
		audio.play().catch(error => {
			console.error('Playback failed:', error);
			updateVoiceStatus('error', 'Audio playback failed');
		});

	} catch (error) {
		console.error('Processing error:', error);
		updateVoiceStatus('error', error.message.includes('TTS') ? 'Voice synthesis failed' : 'Service unavailable');
	}
}

function updateVoiceStatus(state, message) {
	const statusElement = document.getElementById('status');
	const micBtn = document.getElementById('micBtn');

	micBtn.classList.remove('listening', 'shaking');
	statusElement.style.color = '';

	switch(state) {
		case 'initial':
			statusElement.textContent = 'Click the mic to start';
			break;
		case 'listening':
			statusElement.textContent = 'Listening...';
			micBtn.classList.add('listening');
			break;
		case 'processing':
			statusElement.textContent = 'Thinking...';
			break;
		case 'speaking':
			statusElement.textContent = 'Speaking...';
			micBtn.classList.add('shaking');
			break;
		case 'ready':
			statusElement.textContent = 'Ready to interact';
			break;
		case 'error':
			statusElement.textContent = message || 'Error occurred';
			statusElement.style.color = '#ef4444';
			break;
	}
}

document.addEventListener('DOMContentLoaded', initializeVoiceAssistant);

async function regenerateMessage(messageIndex) {
	const history = chatHistory.get(currentConversationId);
	if (!history || messageIndex >= history.length) {
		console.error('Invalid message index');
		return;
	}

	const targetMessage = history[messageIndex];

	if (targetMessage.role !== 'user') {
		console.error('Can only regenerate from user messages');
		return;
	}
	history.splice(messageIndex + 1);

	const wrapper = document.querySelector('.message-wrapper');
	const allContainers = [...wrapper.querySelectorAll('.message-container')];
	const aiContainer = allContainers[messageIndex + 1];
	let container;
	if (aiContainer) {
		container = aiContainer;
		container.innerHTML = '';
	} else {
		container = document.createElement('div');
		container.className = 'message-container';
		wrapper.appendChild(container);
	}
	const typingDiv = document.createElement('div');
	typingDiv.className = 'message ai';
	typingDiv.innerHTML = '<div class="message-content">Processing...</div>';
	container.appendChild(typingDiv);
	scrollToBottom();

	try {
		const response = await generateAnswer(history);
		const aiResponse = response.choices?.[0]?.message?.content || "I'm sorry, I couldn't process your request.";
		history.push({ role: 'assistant', content: aiResponse });
		saveChatHistory();
		const parsedContent = marked.parse(aiResponse);
		const safeHtml = DOMPurify.sanitize(parsedContent);
		typingDiv.innerHTML = `<div class="message-content">${safeHtml}</div>`;
		enhanceCodeBlocks(container);
		attachAiCopyButton(container);

	} catch (error) {
		console.error(error);
		typingDiv.innerHTML = `<div class="message-content">Sorry, I'm experiencing technical difficulties. Please try again.</div>`;
	}
}

function enableMessageEditing(messageElement, originalContent, messageIndex) {
	messageElement._originalContent = originalContent;
	messageElement._originalHTML = messageElement.innerHTML;
	
	const textarea = document.createElement('textarea');
	textarea.className = 'edit-textarea';
	let textContent = '';
	try {
		const parsed = JSON.parse(originalContent);
		textContent = parsed.text || '';
	} catch {
		textContent = originalContent;
	}
	
	textarea.value = textContent;
	
	const actionsDiv = document.createElement('div');
	actionsDiv.className = 'edit-actions';
	
	const saveBtn = document.createElement('button');
	saveBtn.className = 'edit-save';
	saveBtn.textContent = 'Save';
	saveBtn.onclick = () => saveEditedMessage(messageElement, messageIndex);
	
	const cancelBtn = document.createElement('button');
	cancelBtn.className = 'edit-cancel';
	cancelBtn.textContent = 'Cancel';
	cancelBtn.onclick = () => cancelMessageEdit(messageElement);
	
	actionsDiv.appendChild(cancelBtn);
	actionsDiv.appendChild(saveBtn);
	messageElement.classList.add('message-editable');
	messageElement.innerHTML = '';
	messageElement.appendChild(textarea);
	messageElement.appendChild(actionsDiv);
	textarea.focus();
	textarea.select();
}
function saveEditedMessage(messageElement, messageIndex) {
	const textarea = messageElement.querySelector('.edit-textarea');
	const newContent = textarea.value.trim();
	
	if (!newContent) {
		cancelMessageEdit(messageElement);
		return;
	}

	const history = chatHistory.get(currentConversationId);
	if (!history || !history[messageIndex]) {
		console.error('History not found');
		return;
	}
	try {
		const originalContent = JSON.parse(history[messageIndex].content);
		originalContent.text = newContent;
		history[messageIndex].content = JSON.stringify(originalContent);
	} catch {
		history[messageIndex].content = newContent;
	}
	history.splice(messageIndex + 1);
	
	saveChatHistory();
	loadConversation(currentConversationId);
	setTimeout(() => {
		regenerateMessage(messageIndex);
	}, 300);
}

function cancelMessageEdit(messageElement) {
	messageElement.classList.remove('message-editable');
	messageElement.innerHTML = messageElement._originalHTML;
	delete messageElement._originalContent;
	delete messageElement._originalHTML;
}
function addMessageActions(container, messageContent, messageIndex) {
	const actionsDiv = document.createElement('div');
	actionsDiv.className = 'message-actions';

	const editBtn = document.createElement('button');
	editBtn.className = 'message-action-btn';
	editBtn.innerHTML = '<i class="fas fa-edit"></i>';
	editBtn.onclick = (e) => {
		e.stopPropagation();
		const msgElement = container.querySelector('.message');
		const historyIndex = Array.from(container.parentNode.children).indexOf(container);
		enableMessageEditing(msgElement, messageContent, historyIndex);
	};
	actionsDiv.appendChild(editBtn);
	const regenerateBtn = document.createElement('button');
	regenerateBtn.className = 'message-action-btn';
	regenerateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
	regenerateBtn.onclick = (e) => {
		e.stopPropagation();
		const historyIndex = Array.from(container.parentNode.children).indexOf(container);
		regenerateMessage(historyIndex);
	};
	actionsDiv.appendChild(regenerateBtn);

	container.appendChild(actionsDiv);
}

function attachAiCopyButton(container) {
	if (container.querySelector('.ai-tools')) return;
	const tools = document.createElement('div');
	tools.className = 'ai-tools';
	const btn = document.createElement('button');
	btn.className = 'copy-all-btn';
	btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
	btn.addEventListener('click', () => {
		const contentEl = container.querySelector('.message-content');
		if (!contentEl) return;
		const text = contentEl.innerText;
		navigator.clipboard.writeText(text).then(() => {
			btn.textContent = 'Copied!';
			setTimeout(() => {
				btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
			}, 1500);
		});
	});
	tools.appendChild(btn);
	container.appendChild(tools);
}


function enhanceCodeBlocks(root) {
	const codeNodes = root.querySelectorAll('pre > code');
	codeNodes.forEach(codeEl => {
		const pre = codeEl.parentElement;
		if (pre.closest('.code-editor')) return;

		if (!codeEl.classList.contains('hljs')) {
			try { hljs.highlightElement(codeEl); } catch {}
		}

		let lang = 'text';
		const className = codeEl.className || '';
		const match = className.match(/language-([\w-]+)/i) || className.match(/hljs\s+([\w-]+)/i);
		if (match && match[1]) { lang = match[1].toLowerCase(); }

		const wrapper = document.createElement('div');
		wrapper.className = 'code-editor';

		const header = document.createElement('div');
		header.className = 'code-editor-header';
		const langSpan = document.createElement('span');
		langSpan.className = 'code-editor-lang';
		langSpan.textContent = lang;
		const actions = document.createElement('div');
		actions.className = 'code-editor-actions';

		const copyBtn = document.createElement('button');
		copyBtn.className = 'code-editor-btn';
		copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
		copyBtn.addEventListener('click', () => {
			const text = codeEl.textContent;
			navigator.clipboard.writeText(text).then(() => {
				copyBtn.textContent = 'Copied!';
				setTimeout(() => copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy', 1500);
			});
		});

		actions.appendChild(copyBtn);
		header.appendChild(langSpan);
		header.appendChild(actions);

		const body = document.createElement('div');
		body.className = 'code-editor-body';

		pre.replaceWith(wrapper);
		body.appendChild(pre);
		wrapper.appendChild(header);
		wrapper.appendChild(body);
	});
}

let uploadedImages = [];
const IMAGE_ANALYSIS_API = "https://ab-tech-ai.abrahamdw882.workers.dev/";
const FILE_UPLOAD_URL = "https://url-uploader-catboxy.vercel.app/upload";

document.getElementById('imageUpload').addEventListener('change', async function(e) {
	const files = e.target.files;
	
	if (currentModel.name !== 'default') {
		showModelSwitchPrompt();
		this.value = ''; 
		return;
	}

	const previewContainer = document.getElementById('imagePreviews');
	const loader = document.createElement('div');
	loader.className = 'upload-loader';
	previewContainer.appendChild(loader);
	loader.style.display = 'block';

	try {
		for (let file of files) {
			const formData = new FormData();
			formData.append('fileToUpload', file);

			const response = await fetch(FILE_UPLOAD_URL, {
				method: 'POST',
				body: formData
			});
			
			if (!response.ok) {
				console.error('Upload failed:', response.status);
				continue;
			}

			const result = await response.json();
			if (!result.url) {
				console.error('Upload failed: No URL returned');
				continue;
			}

			const imageUrl = result.url;
			const preview = document.createElement('div');
			preview.className = 'preview-item';
			preview.innerHTML = `
				<img src="${imageUrl}" class="upload-preview">
				<button class="remove-btn" onclick="removeImage('${imageUrl}')">×</button>
			`;
			
			previewContainer.appendChild(preview);
			uploadedImages.push({
				dataUrl: imageUrl,
				analysis: null
			});
		}
	} catch (err) {
		console.error("Upload error:", err);
	} finally {
		previewContainer.removeChild(loader);
	}
});

async function analyzeImage(imageUrl, prompt = "") {
	try {
		let apiUrl = `${IMAGE_ANALYSIS_API}?img_url=${encodeURIComponent(imageUrl)}`;
		if (prompt) {
			apiUrl += `&q=${encodeURIComponent(prompt)}`;
		} else {
			apiUrl += `&q=Describe%20this%20image`;
		}
		
		const response = await fetch(apiUrl);
		if (!response.ok) throw new Error('Image analysis failed');
		const data = await response.json();
		return data.response;
	} catch (error) {
		console.error('Image analysis error:', error);
		return "Failed to analyze image";
	}
}

function removeImage(dataUrl) {
	uploadedImages = uploadedImages.filter(img => img.dataUrl !== dataUrl);
	const previews = document.querySelectorAll('.preview-item');
	previews.forEach(preview => {
		if (preview.querySelector('img').src === dataUrl) {
			preview.remove();
		}
	});
}

let currentImageBlob = null;

function openImageGenerator() {
	document.getElementById("confirmationModal").style.display = "flex";
}

function proceedToGenerate() {
	closeConfirmation();
	document.getElementById("imageModal").style.display = "flex";
	document.getElementById("promptInput").focus();
}

function closeConfirmation() {
	document.getElementById("confirmationModal").style.display = "none";
}

async function generateImage() {
	const prompt = document.getElementById("promptInput").value;
	const generateButton = document.getElementById("generateButton");
	const loader = document.getElementById("loader");
	const generatedImage = document.getElementById("generatedImage");
    const downloadButton = document.getElementById("downloadButton");
	const error = document.getElementById("error");

	generatedImage.style.display = "none";
	downloadButton.style.display = "none";
	error.style.display = "none";
	error.innerText = "";
	currentImageBlob = null;

	if (!prompt) {
		error.style.display = "block";
		error.innerText = "Please enter a prompt.";
		return;
	}

	generateButton.disabled = true;
	loader.style.display = "block";

	try {
		const apiUrl = `https://ab-hyper-ai.abrahamdw882.workers.dev/?q=${encodeURIComponent(prompt)}`;
		const response = await fetch(apiUrl);

		if (!response.ok) throw new Error(`API request failed (${response.status})`);
		
		currentImageBlob = await response.blob();
		const imageUrl = URL.createObjectURL(currentImageBlob);
		
		generatedImage.src = imageUrl;
		generatedImage.style.display = "block";
		downloadButton.style.display = "block";
	} catch (err) {
		error.style.display = "block";
		error.innerText = "Failed to generate image. Please try again.";
	} finally {
		generateButton.disabled = false;
		loader.style.display = "none";
	}
}

function downloadImage() {
	if (!currentImageBlob) return;
	const link = document.createElement("a");
	link.download = "generated-image.png";
	link.href = URL.createObjectURL(currentImageBlob);
	link.click();
}

function closeModal() {
	document.getElementById("imageModal").style.display = "none";
	currentImageBlob = null;
}
document.getElementById("promptInput").addEventListener("keypress", (e) => {
	if (e.key === "Enter") generateImage();
});
   
const chatHistory = new Map();
let currentConversationId = null;
const MAX_HISTORY = 10;

marked.setOptions({
	breaks: true,
	highlight: function(code) {
		return hljs.highlightAuto(code).value;
	}
});

function saveChatHistory() {
	const historyArray = Array.from(chatHistory.entries());
	localStorage.setItem('chatHistory', JSON.stringify(historyArray));
}

function loadChatHistory() {
	const savedHistory = localStorage.getItem('chatHistory');
	if (savedHistory) {
		const historyArray = JSON.parse(savedHistory);
		historyArray.forEach(([id, messages]) => {
			chatHistory.set(id, messages);
		});
	}
}

function saveConversationList() {
	const conversationList = Array.from(chatHistory.keys());
	localStorage.setItem('conversationList', JSON.stringify(conversationList));
}

function loadConversationList() {
	const savedConversationList = localStorage.getItem('conversationList');
	if (savedConversationList) {
		const conversationList = JSON.parse(savedConversationList);
		conversationList.forEach(id => {
			if (!chatHistory.has(id)) {
				chatHistory.set(id, []); 
			}
		});
	}
}

function addInitialMessage() {
	const wrapper = document.getElementById('chatContainer').querySelector('.message-wrapper');
	wrapper.innerHTML = `
		<div class="initial-container">
			<img src="https://i.imgur.com/WnKjrJt.jpeg" class="initial-avatar">
			<div class="message ai initial-message">
				<div class="message-content">
						<br><br>
						Hello! I'm A
						TOHID AI Assistant. How can I help you today? 😊
						<br><br>
						<small style="color: var(--text-secondary)">
							I can help with programming, research, and general knowledge.
						</small>
				</div>
			</div>
		</div>
	`;
}

function toggleSidebar() {
	const sidebar = document.getElementById('sidebar');
	const overlay = document.getElementById('overlay');
	
	sidebar.classList.toggle('active');
	overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
	
	if (sidebar.classList.contains('active')) {
		document.body.classList.add('no-scroll');
	} else {
		document.body.classList.remove('no-scroll');
	}
}

document.addEventListener('click', function(event) {
	const sidebar = document.getElementById('sidebar');
	const menuToggle = document.querySelector('.menu-toggle');
	const overlay = document.getElementById('overlay');
	const isClickInsideSidebar = sidebar.contains(event.target);
	const isClickOnMenuToggle = menuToggle.contains(event.target);
	
	if (sidebar.classList.contains('active') && !isClickInsideSidebar && !isClickOnMenuToggle) {
		sidebar.classList.remove('active');
		overlay.style.display = 'none';
		document.body.classList.remove('no-scroll');
	}
});

document.addEventListener('keydown', function(event) {
	const sidebar = document.getElementById('sidebar');
	if (event.key === 'Escape' && sidebar.classList.contains('active')) {
		sidebar.classList.remove('active');
		document.getElementById('overlay').style.display = 'none';
		document.body.classList.remove('no-scroll');
	}
});

function createNewConversation() {
	currentConversationId = Date.now().toString();
	chatHistory.set(currentConversationId, []);
	clearChatContainer();
	addInitialMessage();
	updateConversationList();
	document.getElementById('conversationList').style.display = 'block';
	saveChatHistory();
	saveConversationList();
	const sidebar = document.getElementById('sidebar');
	sidebar.classList.remove('active');
	document.getElementById('overlay').style.display = 'none';
	document.body.classList.remove('no-scroll');

	document.getElementById('userInput').focus();
}

function updateConversationList() {
	const list = document.getElementById('conversationList');
	list.innerHTML = Array.from(chatHistory.entries()).map(([id, messages]) => {

		let previewText = 'New Conversation';
		if (messages.length > 0) {
			const aiMessage = messages.find(msg => msg.role === 'assistant');
			if (aiMessage) {
				previewText = typeof aiMessage.content === 'string' ? aiMessage.content : '';
			} else {
				try {
					const userContent = JSON.parse(messages[0].content);
					previewText = typeof userContent.text === 'string' ? userContent.text : '';
				} catch {
					previewText = typeof messages[0].content === 'string' ? messages[0].content : '';
				}
			}
		}
		previewText = previewText || 'New Conversation';
		const safePreview = escapeHtml(previewText);
		
		return `
	<div class="conversation-item" data-id="${id}">
		<div onclick="loadConversation('${id}')">
			${safePreview.substring(0, 30) + (safePreview.length > 30 ? '...' : '')}
			<small style="color: var(--text-secondary)">
				${new Date(parseInt(id)).toLocaleDateString()}
			</small>
		</div>
		<button class="delete-btn" onclick="deleteConversation('${id}', event)">
			<i class="fas fa-trash"></i>
		</button>
	</div>
`;
	}).join('');
	saveConversationList();
}

function loadConversation(conversationId) {
	currentConversationId = conversationId;
	const history = chatHistory.get(conversationId) || [];
	clearChatContainer();
	
	const wrapper = document.getElementById('chatContainer').querySelector('.message-wrapper');
	history.forEach(msg => {
		const message = createMessage(msg.content, msg.role);
		wrapper.appendChild(message);
	});
	enhanceCodeBlocks(wrapper);
	
	scrollToBottom();
}

function clearChatContainer() {
	const messageWrapper = document.getElementById('chatContainer').querySelector('.message-wrapper');
	messageWrapper.innerHTML = ''; 
}

function deleteConversation(conversationId, event) {
  event.stopPropagation();
	if (!confirm('Are you sure you want to delete this conversation?')) return;

	chatHistory.delete(conversationId);
	saveChatHistory();
	saveConversationList();

	if (currentConversationId === conversationId) {
		currentConversationId = null;
		clearChatContainer();
		addInitialMessage();
	}

	updateConversationList();
}

function logout() {
	if (confirm('Are you sure you want to log out?')) {
		localStorage.removeItem('chatHistory');
		localStorage.removeItem('conversationList');
		window.location.href = '#';
	}
}
async function typeWriter(messageDiv, safeHtml, index = 0) {
    if (index < safeHtml.length) {
        messageDiv.innerHTML = `<div class="message-content">${safeHtml.substring(0, index)}</div><span class="typing-cursor"></span>`;
        index++;
        setTimeout(() => typeWriter(messageDiv, safeHtml, index), getRandomDelay());
    } else {
        messageDiv.innerHTML = `<div class="message-content">${safeHtml}</div>`;
        enhanceCodeBlocks(messageDiv.parentElement);
        attachAiCopyButton(messageDiv.parentElement);
    }
}
let isGenerating = false;
async function sendMessage() {
	if (isGenerating) return;

	const userInput = document.getElementById('userInput');
	const message = userInput.value.trim();
	userInput.value = '';
	if (uploadedImages.length > 0 && currentModel.name !== 'default') {
		showModelSwitchPrompt();
		return;
	}

	if (!message && uploadedImages.length === 0) return;

	if (!currentConversationId) {
		createNewConversation();
	}

	const initialContainer = document.querySelector('.initial-container');
	if (initialContainer && chatHistory.get(currentConversationId).length === 0) {
		initialContainer.remove();
	}

	isGenerating = true;
	userInput.disabled = true;
	document.querySelector('.send-btn').style.color = '#3b82f6';

	try {
		const history = chatHistory.get(currentConversationId);
		let userMessageContent;

		if (currentModel.name === 'default') {
			userMessageContent = JSON.stringify({
				images: uploadedImages.map(img => img.dataUrl),
				text: message
			});
		} else {
			userMessageContent = message;
		}
		const userMessage = createMessage(
			currentModel.name === 'default' ? userMessageContent : message,
			'user',
			uploadedImages.length > 0
		);
		document.getElementById('chatContainer').querySelector('.message-wrapper').appendChild(userMessage);

		history.push({
			role: 'user',
			content: userMessageContent
		});
		const aiMessageContainer = document.createElement('div');
		aiMessageContainer.className = 'message-container ai';
		
		const aiMessageDiv = document.createElement('div');
		aiMessageDiv.className = 'message ai';
		aiMessageDiv.innerHTML = `
<div class="message-content">
<span class="typing-indicator">
	<div class="typing-dot"></div>
	<div class="typing-dot"></div>
	<div class="typing-dot"></div>
</span>
<span class="typing-cursor"></span>
</div>
`;
		
		aiMessageContainer.appendChild(aiMessageDiv);
		document.getElementById('chatContainer').querySelector('.message-wrapper').appendChild(aiMessageContainer);
		scrollToBottom();

		let aiResponse;
		if (currentModel.name === 'default' && uploadedImages.length > 0) {
			const analysisPromises = uploadedImages.map(img => 
				analyzeImage(img.dataUrl, message)
			);
			const analyses = await Promise.all(analysisPromises);
			aiResponse = analyses.join('\n\n');
		} else {
			const response = await generateAnswer(history);
			aiResponse = response.choices?.[0]?.message?.content || "I'm sorry, I couldn't process your request.";
		}
		const parsedContent = marked.parse(aiResponse);
		const safeHtml = DOMPurify.sanitize(parsedContent);
		aiMessageDiv.innerHTML = `<div class="message-content">${safeHtml}</div>`;
		enhanceCodeBlocks(aiMessageContainer);
		attachAiCopyButton(aiMessageContainer);
        typeWriter(aiMessageDiv, safeHtml);

        
		history.push({ role: 'assistant', content: aiResponse });
		updateConversationList();
		saveChatHistory();

		userInput.value = '';
		uploadedImages = [];
		document.getElementById('imagePreviews').innerHTML = '';

		const menuToggle = document.querySelector('.menu-toggle');
		menuToggle.classList.add('has-new-message');

	} catch (error) {
		console.error(error);
		const errorMessage = createMessage("Sorry, I'm experiencing technical difficulties. Please try again.", 'ai');
		document.getElementById('chatContainer').querySelector('.message-wrapper').appendChild(errorMessage);
	} finally {
		isGenerating = false;
		userInput.disabled = false;
		document.querySelector('.send-btn').style.color = '';
		scrollToBottom();
	}
}
function getRandomDelay() {
    return Math.floor(Math.random() * 5) + 1; 
}
function escapeHtml(str) {
	if (typeof str !== 'string') return str;
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function createMessage(content, type, messageIndex) {
	const container = document.createElement('div');
	container.className = 'message-container';

	const messageDiv = document.createElement('div');
	const isAi = type === 'ai' || type === 'assistant';
	messageDiv.className = isAi ? 'message ai' : `message ${type}`;
	
	let parsedContent;
	try {
		parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
	} catch {
		parsedContent = content;
	}

	let contentHTML = '';
	if (parsedContent && parsedContent.images && Array.isArray(parsedContent.images) && parsedContent.images.length > 0) {
		contentHTML += parsedContent.images.map(img => 
			`<img src="${img}" class="upload-preview" style="max-width: min(100%, 400px); border-radius: 8px; margin-bottom: 8px; display: block;">`
		).join('');
	}

	let textContent = '';
	if (isAi) {
		if (typeof parsedContent === 'string') {
			textContent = parsedContent;
		} else if (parsedContent && typeof parsedContent.text === 'string') {
			textContent = parsedContent.text;
		} else if (typeof content === 'string') {
			textContent = content;
		}
	} else {
		if (parsedContent && typeof parsedContent.text === 'string') {
			textContent = parsedContent.text;
		} else if (typeof content === 'string') {
			textContent = content;
		}
	}

	textContent = (textContent || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

	const finalText = isAi
		? DOMPurify.sanitize(marked.parse(textContent || ''))
		: escapeHtml(textContent).replace(/\n/g, '<br>');

	messageDiv.innerHTML = `<div class="message-content">${contentHTML}${finalText}</div>`;
	container.appendChild(messageDiv);
	
	const historyIndex = chatHistory.get(currentConversationId)?.length - 1;
	if (!isAi) {
		addMessageActions(container, content, historyIndex);
	} else {
		attachAiCopyButton(container);
		enhanceCodeBlocks(container);
	}
	
	return container;
}

async function generateAnswer(history) {
	const isChatEndpoint = currentModel.name === 'default';
	
	try {
		if (isChatEndpoint) {
			const response = await fetch(currentModel.endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: history })
			});
			const data = await response.json();
			return simulateTypingEffect(data);
		} else {
			const lastMessage = history[history.length - 1].content;
			if (!lastMessage || lastMessage === 'undefined') {
				throw new Error('Invalid message content');
			}

			const encodedQuery = encodeURIComponent(lastMessage);
			const url = `${currentModel.endpoint}${encodedQuery}`;
			
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			
			const data = await response.json();
			
			if (currentModel.name === 'llama') {
				return simulateTypingEffect({ 
					choices: [{
						message: { 
							content: data.response || data.data || "No response available"
						}
					}]
				});
			}
			
			if (currentModel.name === 'gemini') {
				const responseText = data.response || "No response available";
				return simulateTypingEffect({
					choices: [{
						message: { content: responseText }
					}]
				});
			}
			
			return data;
		}
	} catch (error) {
		console.error('API Error:', error);
		throw error;
	}
}

async function simulateTypingEffect(response) {
	const fullText = response.choices[0].message.content;
	const messageContainer = document.querySelector('.message-container:last-child');
	const messageDiv = messageContainer.querySelector('.message.ai');
	const parsedContent = marked.parse(fullText);
	const safeHtml = DOMPurify.sanitize(parsedContent);
	messageDiv.innerHTML = `<div class="message-content">${safeHtml}</div>`;
	enhanceCodeBlocks(messageContainer);
	attachAiCopyButton(messageContainer);
	return response;
}

function scrollToBottom() {
	const container = document.getElementById('chatContainer');
	container.scrollTop = container.scrollHeight;
}

document.getElementById('userInput').addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

document.addEventListener('DOMContentLoaded', () => {
	const dropdownBtn = document.querySelector('.dropdown-btn');
	if (!localStorage.getItem('modelPromptDismissed')) {
		dropdownBtn.classList.add('show-model-prompt');
		const handleFirstClick = () => {
			dropdownBtn.classList.remove('show-model-prompt');
			localStorage.setItem('modelPromptDismissed', 'true');
			document.removeEventListener('click', handleFirstClick);
		};
		
		document.addEventListener('click', handleFirstClick, { once: true });
	}
	loadChatHistory(); 
	loadConversationList(); 
	updateConversationList();
	const savedModel = localStorage.getItem('selectedModel');
	if (savedModel) {
		currentModel = JSON.parse(savedModel);
		const el = document.querySelector(`[data-model="${currentModel.name}"]`);
		if (el) el.classList.add('active');
	}
	
	document.querySelectorAll('.model-item').forEach(item => {
		item.addEventListener('click', function() {
			currentModel = {
				name: this.dataset.model,
				endpoint: this.dataset.endpoint
			};
			
			document.querySelectorAll('.model-item').forEach(i => i.classList.remove('active'));
			this.classList.add('active');
			document.getElementById('modelDropdown').classList.remove('show');
			
			localStorage.setItem('selectedModel', JSON.stringify(currentModel));
		});
	});
	if (chatHistory.size > 0) {
		const lastConversationId = Array.from(chatHistory.keys())[chatHistory.size - 1];
		currentConversationId = lastConversationId; 
		loadConversation(lastConversationId); 
	} else {
		addInitialMessage();
	}
});

function toggleDropdown() {
	const dropdown = document.getElementById('modelDropdown');
	
	dropdown.classList.toggle('show');
}
		
function toggleNotificationPanel() {
	const panel = document.getElementById('notificationPanel');
	panel.classList.add('active');
	
	setTimeout(() => {
		panel.classList.remove('active');
	}, 3000);
}

function hideNotificationPanel() {
	document.getElementById('notificationPanel').classList.remove('active');
}

document.addEventListener('click', (e) => {
	const panel = document.getElementById('notificationPanel');
	if (!panel.contains(e.target) && !e.target.closest('.notification-btn')) {
		panel.classList.remove('active');
	}
});

let touchStartX = 0;
const panel = document.getElementById('notificationPanel');

panel.addEventListener('touchstart', e => {
	touchStartX = e.changedTouches[0].screenX;
});

panel.addEventListener('touchend', e => {
	const touchEndX = e.changedTouches[0].screenX;
	if (touchStartX - touchEndX > 50) {
		hideNotificationPanel();
	}
});
	
