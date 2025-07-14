// const dotenv = require('dotenv');
// // Load environment variables from .env file
// dotenv.config();
// require('dotenv');
// --- API Configuration ---
// const API_KEY = require('./private.js')(); // Call the function to get the API key

// const API_KEY = require("./private");

// console.log("API Key:", API_KEY); // For debugging purposes, remove in production
API_KEY = API_KEY(); // Ensure we call the function to get the key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// --- DOM Element References ---
const messageInput = document.querySelector("#prompt");
const submitButton = document.querySelector("#submit");
const chatArea = document.querySelector("#chatContainer");
const imageButton = document.querySelector("#image-button");
const imageInput = document.querySelector("#image-input");
const imagePreviewOverlay = document.querySelector("#image-preview-overlay");
const destinationSelect = document.querySelector("#destinationSelect");


// --- State Object ---
let userInteraction = {
    message: null,
    file: { mime_type: null, data: null, name: null }
};

// --- Conversation Context ---
let conversationContext = [];

/** Adjusts textarea height dynamically */
function autoGrowTextarea() {
    messageInput.style.height = 'auto';
    const computedStyle = getComputedStyle(messageInput);
    const maxHeight = parseInt(computedStyle.maxHeight, 10) || 112;
    const scrollHeight = messageInput.scrollHeight;
    const padding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
    const newHeight = Math.min(scrollHeight, maxHeight);
    messageInput.style.height = newHeight + 'px';
    messageInput.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
}

/** Scrolls chat area to the bottom */
function scrollToBottom() {
    setTimeout(() => {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" });
    }, 50);
}

/**
 * Creates an HTML element for a chat message
 */
function createMessageElement(bubbleContent, type) {
    const messageContainer = document.createElement("div");
    const avatarIcon = type === 'user' ? 
        '<i class="fas fa-user text-travel-primary"></i>' : 
        '<i class="fas fa-globe-americas text-travel-primary"></i>';
    
    const bubbleClasses = type === 'user'
        ? 'bg-travel-primary text-white rounded-br-lg ml-auto'
        : 'bg-gray-100 border border-subtle-border text-text-dark rounded-bl-lg mr-auto';
    const alignmentClass = type === 'user' ? 'ml-auto' : 'mr-auto';
    const avatarOrderClass = type === 'user' ? 'order-last' : '';

    messageContainer.className = `message-container flex items-end gap-2 max-w-[85%] ${alignmentClass}`;

    messageContainer.innerHTML = `
        <div class="w-10 h-10 rounded-full flex-shrink-0 border-2 border-gray-200 shadow-sm ${avatarOrderClass} bg-white flex items-center justify-center">
            ${avatarIcon}
        </div>
        <div class="p-3 px-4 rounded-xl shadow-sm ${bubbleClasses}">
            <div class="text-base leading-relaxed message-content">${bubbleContent}</div>
        </div>
    `;

    requestAnimationFrame(() => {
        setTimeout(() => { messageContainer.classList.add('animate-in'); }, 10);
    });
    return messageContainer;
}

/** Clears the image preview state and UI */
function clearImagePreview() {
    userInteraction.file = { mime_type: null, data: null, name: null };
    imagePreviewOverlay.src = "";
    imagePreviewOverlay.classList.remove('active');
    imageInput.value = "";
    imageButton.title = "Upload Image";
}

/** Calls the Gemini API to get a response */
async function generateResponse(thinkingBubble) {
    const aiChatBubbleContainer = thinkingBubble.querySelector(".message-content");
    const selectedLanguage = destinationSelect.value;

    let instruction = `You are a knowledgeable and friendly AI Travel Guide. Your role is to:
    1. Provide detailed travel advice, recommendations, and insights
    2. Share cultural information and local customs
    3. Suggest itineraries and must-visit locations
    4. Offer practical travel tips (transportation, accommodation, etc.)
    5. Help with travel planning and budgeting
    6. Identify landmarks or locations in shared images
    
    Please respond in ${selectedLanguage} language. If an image is shared, analyze it for travel-related context and provide relevant information.`;

    if (conversationContext.length > 0) {
        instruction += " Previous conversation context:\n";
        conversationContext.forEach((entry) => {
            instruction += `${entry.role}: ${entry.content}\n`;
        });
    }

    if (userInteraction.message) {
        instruction += ` Current query: "${userInteraction.message}"`;
    }
    if (userInteraction.file.name) {
        instruction += ` Analyze the uploaded image: ${userInteraction.file.name}`;
    }

    if (!userInteraction.message && !userInteraction.file.name) {
        thinkingBubble.remove();
        alert("Please type a message or upload an image to start!");
        return;
    }

    const requestParts = [{ text: instruction }];
    if (userInteraction.file.data && userInteraction.file.mime_type) {
        // Ensure Base64 data is stripped of the prefix
        const base64Data = userInteraction.file.data.replace(/^data:[^;]+;base64,/, '');
        requestParts.push({
            inline_data: { mimeType: userInteraction.file.mime_type, data: base64Data }
        });
    }

    console.log(JSON.stringify({ contents: [{ parts: requestParts }] }, null, 2));

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: requestParts }] })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data?.error?.message || `API Error: ${response.status}`);
        }

        let apiResponseText = "Let me think about that... 🤔";

        if (data.candidates?.[0]?.content?.parts?.length > 0) {
            apiResponseText = data.candidates[0].content.parts
                .map(part => part.text || '')
                .join(' ')
                .trim()
                .replace(/</g, "<")
                .replace(/>/g, ">")
                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>')
                .replace(/\n/g, '<br>');
        }

        aiChatBubbleContainer.innerHTML = apiResponseText;
        conversationContext.push({ role: 'assistant', content: apiResponseText });

        if (conversationContext.length > 6) {
            conversationContext.splice(0, conversationContext.length - 6);
        }

    } catch (error) {
        console.error("Error:", error);
        aiChatBubbleContainer.innerHTML = `<span class="text-red-500">Oops! Something went wrong: ${error.message}</span>`;
    } finally {
        thinkingBubble.classList.add('animate-in');
        scrollToBottom();
    }
}

/** Handles sending user message and initiating AI response */
function handleSendMessage() {
    let userMessage = messageInput.value.trim();
    const hasImage = userInteraction.file.data;

    if (!userMessage && !hasImage) return;

    userMessage = userMessage.replace(/\s+/g, ' ');
    userInteraction.message = userMessage;

    let userBubbleContent = '';
    if (userMessage) {
        userBubbleContent += userMessage.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, '<br>');
    }
    if (hasImage) {
        const imageName = userInteraction.file.name.replace(/</g, "<").replace(/>/g, ">");
        userBubbleContent += `${userMessage ? '<br>' : ''}<span class="text-xs italic block mt-1 opacity-70">(Image: ${imageName})</span>`;
    }

    const userMessageElement = createMessageElement(userBubbleContent, 'user');
    chatArea.appendChild(userMessageElement);

    const stagedFile = { ...userInteraction.file };
    messageInput.value = "";
    clearImagePreview();
    autoGrowTextarea();
    scrollToBottom();

    const thinkingBubbleHTML = `<div class="flex items-center space-x-1.5 py-1">
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
    </div>`;
    const thinkingElement = createMessageElement(thinkingBubbleHTML, 'ai');
    chatArea.appendChild(thinkingElement);
    scrollToBottom();

    userInteraction.file = stagedFile;
    generateResponse(thinkingElement).finally(() => {
        userInteraction.file = { mime_type: null, data: null, name: null };
    });
}

/** Handles image file selection */
function handleImageSelection() {
    const file = imageInput.files[0];
    if (!file) { clearImagePreview(); return; }

    if (!file.type.startsWith("image/")) {
        alert("Please select an image file!");
        clearImagePreview();
        return;
    }

    const maxSizeMB = 4;
    if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`Image too large! Max ${maxSizeMB} MB.`);
        clearImagePreview();
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        userInteraction.file = {
            mime_type: file.type,
            data: e.target.result.split(",")[1],
            name: file.name
        };
        imagePreviewOverlay.src = e.target.result;
        imagePreviewOverlay.classList.add('active');
        imageButton.title = `Image: ${file.name} (Click to clear)`;
    };
    reader.onerror = (error) => {
        console.error("File error:", error);
        alert("Error reading image file.");
        clearImagePreview();
    };
    reader.readAsDataURL(file);
}

// --- Event Listeners ---
messageInput.addEventListener('input', autoGrowTextarea);
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});
submitButton.addEventListener("click", handleSendMessage);
imageButton.addEventListener("click", () => {
    if (imagePreviewOverlay.classList.contains('active')) {
        clearImagePreview();
    } else {
        imageInput.click();
    }
});
imageInput.addEventListener("change", handleImageSelection);

// Handle language selection
destinationSelect.addEventListener('change', () => {
    const selectedLanguage = destinationSelect.value;
    const languageNames = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'ja': 'Japanese',
        'zh': 'Chinese',
        'hi': 'Hindi'
    };
    
    const welcomeMessages = {
        'en': 'Welcome to the AI Travel Guide! How can I help you plan your journey?',
        'es': '¡Bienvenido a la Guía de Viajes AI! ¿Cómo puedo ayudarte a planificar tu viaje?',
        'fr': 'Bienvenue dans le Guide de Voyage IA ! Comment puis-je vous aider à planifier votre voyage ?',
        'de': 'Willkommen beim KI-Reiseführer! Wie kann ich Ihnen bei der Reiseplanung helfen?',
        'it': 'Benvenuto nella Guida di Viaggio AI! Come posso aiutarti a pianificare il tuo viaggio?',
        'ja': 'AI旅行ガイドへようこそ！旅行の計画をどのようにお手伝いしましょうか？',
        'zh': '欢迎使用AI旅行指南！我可以如何帮助您规划旅程？',
        'hi': 'AI यात्रा गाइड में आपका स्वागत है! मैं आपकी यात्रा की योजना बनाने में कैसे मदद कर सकता हूं?'
    };
    
    const welcomeMessage = welcomeMessages[selectedLanguage] || welcomeMessages['en'];
    
    // Clear previous messages
    chatArea.innerHTML = '';
    
    // Add welcome message
    const welcomeElement = createMessageElement(welcomeMessage, 'ai');
    chatArea.appendChild(welcomeElement);
    scrollToBottom();
});

// --- Initial Setup ---
autoGrowTextarea();
scrollToBottom();

// Initial greeting
if (chatArea.children.length === 0) {
    const initialGreetingHTML = `👋 Welcome to your AI Travel Guide! I can help you plan trips, discover destinations, and provide travel tips. Share photos of places you're interested in or ask me anything about travel!`;
    const initialElement = createMessageElement(initialGreetingHTML, 'ai');
    initialElement.classList.add('animate-in');
    chatArea.appendChild(initialElement);
}