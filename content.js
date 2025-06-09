// Helper function to determine which chat platform we're on
function getChatPlatform() {
    const url = window.location.href;
    if (url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('chat.deepseek.com')) return 'deepseek';
    return null;
}

function getAllQuestions() {
    const platform = getChatPlatform();
    const questions = [];
    let userMessages;

    switch (platform) {
        case 'chatgpt':
            userMessages = document.querySelectorAll('[data-message-author-role="user"]');
            break;
        case 'deepseek':
            userMessages = document.querySelectorAll('div[class^="fa81"][bis_skin_checked="1"]');
            break;
        default:
            return [];
    }
    
    userMessages.forEach((message, index) => {
        let text;
        switch (platform) {
            case 'chatgpt':
                text = message.textContent.trim();
                break;
            case 'deepseek':
                const deepseekText = message.querySelector('div[class^="fbb737a4"]');
                text = deepseekText ? deepseekText.textContent.trim() : message.textContent.trim();
                break;
            default:
                text = message.textContent.trim();
        }

        if (text && text.length > 0) {
            questions.push({
                id: index,
                text: text,
                element: message
            });
        }
    });
    
    return questions;
}

function getChatTitle() {
    const platform = getChatPlatform();
    let titleElement;

    switch (platform) {
        case 'chatgpt':
            titleElement = document.querySelector('title');
            return titleElement ? titleElement.textContent.replace('ChatGPT - ', '') : 'ChatGPT Chat';
        
        case 'deepseek':
            titleElement = document.querySelector('.text-lg.font-medium');
            return titleElement ? titleElement.textContent.trim() : 'Deepseek Chat';
        
        default:
            return 'AI Chat';
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getQuestions") {
        sendResponse({
            questions: getAllQuestions(),
            title: getChatTitle()
        });
        return false;
    } else if (request.action === "scrollToQuestion") {
        const platform = getChatPlatform();
        const messages = platform === 'chatgpt' ? document.querySelectorAll('[data-message-author-role="user"]') :
                        platform === 'deepseek' ? document.querySelectorAll('div[class^="fa81"][bis_skin_checked="1"]') : null;
        
        const targetMessage = messages?.[request.questionId];
        if (targetMessage) {
            targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        sendResponse(true);
        return false;
    }
}); 