document.addEventListener('DOMContentLoaded', function () {
    // Cached DOM elements and globals
    const searchInput = document.getElementById('searchInput');
    const questionsList = document.getElementById('questionsList');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    const defaultColors = ['#EF5350', '#64B5F6', '#81C784', '#FFB74D', '#BA68C8', '#F06292'];
  
    let allQuestions = [];
    let activeTag = 'all';

    let currentChatId = null; // Will be set after we query the active tab
  
    /* ========= Helper Functions ========= */
  
    // Positions any menu element so it stays within the popup viewport.
    function positionMenu(menu, clientX, clientY) {
      const margin = 20;
      menu.style.position = 'fixed';
      menu.style.visibility = 'hidden';
      document.body.appendChild(menu);
  
      const menuHeight = menu.offsetHeight || 300;
      let menuY = clientY;
  
      const viewportCenterY = window.innerHeight / 2;
  
      if (clientY > viewportCenterY) {
          const distanceFromCenterBottom = clientY - viewportCenterY;
          const dynamicUpwardShift = Math.min(menuHeight, distanceFromCenterBottom) ;
  
          menuY = clientY - menuHeight - dynamicUpwardShift - margin;
          menuY = Math.max(margin, menuY);
      } else {
          menuY = clientY + margin;
          const menuBottomY = menuY + menuHeight;
          const viewportBottomEdge = window.innerHeight - margin;
          if (menuBottomY > viewportBottomEdge) {
              menuY -= (menuBottomY - viewportBottomEdge);
          }
      }
  
      let menuX = clientX;
      const bodyWidth = document.body.offsetWidth;
      const menuWidth = menu.offsetWidth || 200;
  
      if (menuX + menuWidth > bodyWidth - 20) {
          menuX = bodyWidth - menuWidth - 20;
      }
      menuX = Math.max(20, menuX);
  
      menu.style.left = `${menuX}px`;
      menu.style.top = `${menuY}px`;
      menu.style.visibility = 'visible';
  }
    // Simple notification popup
    function showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add('show'), 10);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 2000);
    }
  
    // Remove any open context menus (or tag menus)
    function removeContextMenu() {
      document.querySelectorAll('.context-menu, .tag-menu').forEach(menu => menu.remove());
      const questionsContainer = document.querySelector('.questions-container');
      if (questionsContainer) questionsContainer.removeEventListener('scroll', removeContextMenu);
      window.removeEventListener('scroll', removeContextMenu, true);
      // The document click listener is now managed by removeContextMenuOnce
    }

    // Helper to remove the click listener after it's used once
    function removeContextMenuOnce() {
        removeContextMenu();
        document.removeEventListener('click', removeContextMenuOnce);
    }
  
    // Returns a unique chat identifier based on the URL pathname.
    function getChatIdentifier(url) {
      try {
        return new URL(url).pathname;
      } catch (e) {
        return url;
      }
    }
  
    // Checks whether the URL is from a supported chat platform.
    function isSupportedChatTab(url) {
      return url.startsWith('https://chatgpt.com') || url.startsWith('https://chat.deepseek.com');
    }
  
    // Create a context menu item (with an icon) for the popup.
    function createContextMenuItem(text, iconClass) {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.innerHTML = `<i class="fas ${iconClass}"></i>${text}`;
      return item;
    }
  
    /* ========= Theme Management ========= */
    chrome.storage.local.get(['theme'], res => {
      if (res.theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
      }
    });
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      themeIcon.classList.toggle('fa-sun', isDark);
      themeIcon.classList.toggle('fa-moon', !isDark);
      chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
    });
  
    /* ========= Tag Pill Initialization ========= */
    function initTagPills() {
        const tagsContainer = document.querySelector('.tags-container');
        if (tagsContainer) {
            // Clear existing content
            tagsContainer.innerHTML = '';
            
            // Create All button
            const allButton = document.createElement('button');
            allButton.className = 'tag-pill active';
            allButton.dataset.tag = 'all';
            allButton.style.paddingRight = '12px';
            allButton.textContent = 'All';
            
            // Create Favorites button
            const favoritesButton = document.createElement('button');
            favoritesButton.className = 'tag-pill';
            favoritesButton.dataset.tag = 'favorites';
            favoritesButton.innerHTML = '<i class="fas fa-star"></i> Favorites';
            favoritesButton.style.paddingRight = '12px';
            
            // Add click handlers
            [allButton, favoritesButton].forEach(button => {
                button.addEventListener('click', () => {
                    document.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('active'));
                    button.classList.add('active');
                    activeTag = button.dataset.tag;
                    filterQuestions(searchInput.value);
                });
            });
            
            // Add buttons to container
            tagsContainer.append(allButton, favoritesButton);
        }
    }
    initTagPills();
  
    /* ========= Display & Filter Questions ========= */
    function displayQuestions(questions) {
      const mainContainer = document.getElementById('mainContainer');
      const unsupportedContainer = document.getElementById('unsupportedContainer');
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const currentTab = tabs[0];
        if (!isSupportedChatTab(currentTab.url)) {
          mainContainer.style.display = 'none';
          unsupportedContainer.style.display = 'flex';
          return;
        }
        mainContainer.style.display = 'flex';
        unsupportedContainer.style.display = 'none';
        questionsList.innerHTML = '';
  
        if (questions.length === 0) {
          const noQuestions = document.createElement('div');
          noQuestions.className = 'no-questions';
          noQuestions.textContent = 'No questions found in this chat';
          questionsList.appendChild(noQuestions);
          return;
        }
  
        questions.forEach(question => {
          const questionElement = document.createElement('div');
          questionElement.className = 'question-item';
          questionElement.dataset.id = question.id;
  
          // Create text container with a context menu on right-click.
          const textDiv = document.createElement('div');
          textDiv.className = 'question-text';
          textDiv.textContent = question.text;
          textDiv.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, questionElement, textDiv);
          });
  
          // Meta container for tags and actions.
          const metaDiv = document.createElement('div');
          metaDiv.className = 'question-meta';
          const tagsContainer = document.createElement('div');
          tagsContainer.className = 'question-tags';
  

          // Action buttons: copy and delete.
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'question-actions';
          const favoriteButton = document.createElement('button');
          favoriteButton.className = 'action-button favorite-button';
          favoriteButton.innerHTML = '<i class="fas fa-star"></i>';
          favoriteButton.title = 'Add to favorites';
  
          // Set initial favorite state
          if (question.isFavorite) {
              favoriteButton.classList.add('active');
          }
  
          favoriteButton.addEventListener('click', e => {
              e.stopPropagation();
              const isFavorite = favoriteButton.classList.contains('active');
              toggleFavorite(question.id, !isFavorite);
              favoriteButton.classList.toggle('active');
          });
  
          const copyButton = document.createElement('button');
          copyButton.className = 'action-button';
          copyButton.innerHTML = '<i class="fas fa-copy"></i>';
          copyButton.addEventListener('click', e => {
            e.stopPropagation();
            navigator.clipboard.writeText(question.text)
              .then(() => showNotification('Question copied to clipboard'))
              .catch(() => showNotification('Failed to copy text', 'error'));
          });
  
          actionsDiv.append(favoriteButton, copyButton);
  
          metaDiv.append(tagsContainer, actionsDiv);
          questionElement.append(textDiv, metaDiv);
  
          // Clicking a question sends a message to scroll to it.
          questionElement.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "scrollToQuestion",
                questionId: question.id
              });
            });
          });
          questionElement.tags = question.tags || [];
          questionsList.appendChild(questionElement);
        });
      });
    }
  
    // Filters questions based on search text and the currently active tag.
    function filterQuestions(searchText) {
        const scrollContainer = document.querySelector('.questions-container');
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

        const filteredQuestions = allQuestions.filter(question => {
            const matchesSearch = question.text.toLowerCase().includes(searchText.toLowerCase());
            if (activeTag === 'favorites') {
                return matchesSearch && question.isFavorite;
            }
            // For 'all' tag or any other unexpected activeTag, just filter by search text.
            return matchesSearch;
        });

        questionsList.querySelectorAll('.question-item').forEach(questionEl => {
            const questionId = questionEl.dataset.id;
            const shouldShow = filteredQuestions.some(q => q.id.toString() === questionId);
            questionEl.style.display = shouldShow ? 'flex' : 'none';
        });

        if (scrollContainer) scrollContainer.scrollTop = scrollTop;

        const noQuestionsEl = questionsList.querySelector('.no-questions');
        if (filteredQuestions.length === 0) {
            if (!noQuestionsEl) {
                const noQuestions = document.createElement('div');
                noQuestions.className = 'no-questions';
                if (activeTag === 'favorites') {
                    noQuestions.textContent = searchText ? 'No favorite questions match your search.' : 'No favorite questions yet.';
                } else {
                    noQuestions.textContent = searchText ? 'No questions match your search.' : 'No questions found in this chat.';
                }
                questionsList.appendChild(noQuestions);
            } else {
                if (activeTag === 'favorites') {
                    noQuestionsEl.textContent = searchText ? 'No favorite questions match your search.' : 'No favorite questions yet.';
                } else {
                    noQuestionsEl.textContent = searchText ? 'No questions match your search.' : 'No questions found in this chat.';
                }
            }
        } else if (noQuestionsEl) {
            noQuestionsEl.remove();
        }
    }
  
    /* ========= Initialization ========= */
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const currentTab = tabs[0];
      currentChatId = getChatIdentifier(currentTab.url);
      if (!isSupportedChatTab(currentTab.url)) {
        displayQuestions([]);
        return;
      }

      // First load saved favorites
      chrome.storage.local.get([`favorites_${currentChatId}`], favResult => {
        const favorites = favResult[`favorites_${currentChatId}`] || [];
        
        // Then inject content script and load questions
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content.js']
        }).then(() => {
          chrome.tabs.sendMessage(currentTab.id, { action: "getQuestions" }, response => {
            if (chrome.runtime.lastError) {
              console.log(chrome.runtime.lastError);
              displayQuestions([]);
              return;
            }
            if (response) {
              const headerTitle = document.querySelector('header h1');
              if (headerTitle) headerTitle.textContent = response.title || 'AI Chat';
              
              // Apply favorites to questions
              allQuestions = response.questions.map(q => ({
                ...q,
                isFavorite: favorites.includes(q.id)
              }));
              
              displayQuestions(allQuestions);
              filterQuestions(searchInput.value);
            }
          });
        }).catch(err => {
          console.log('Failed to inject content script:', err);
          displayQuestions([]);
        });
      });

    });
  
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        filterQuestions(e.target.value);
      });
    }
  
    // Update the toggleFavorite function to immediately save changes
    function toggleFavorite(questionId, isFavorite) {
      chrome.storage.local.get([`favorites_${currentChatId}`], result => {
        let favorites = result[`favorites_${currentChatId}`] || [];
        
        if (isFavorite && !favorites.includes(questionId)) {
          favorites.push(questionId);
        } else if (!isFavorite) {
          favorites = favorites.filter(id => id !== questionId);
        }
        
        // Immediately save the updated favorites
        chrome.storage.local.set({ [`favorites_${currentChatId}`]: favorites }, () => {
          // Update the allQuestions array
          const questionIndex = allQuestions.findIndex(q => q.id === questionId);
          if (questionIndex !== -1) {
            allQuestions[questionIndex].isFavorite = isFavorite;
          }
          
          // If we're in favorites view, we might need to update the display
          if (activeTag === 'favorites') {
            filterQuestions(searchInput.value);
          }
        });
      });
    }
  });
  