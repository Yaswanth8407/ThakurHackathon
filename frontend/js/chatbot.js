/**
 * The Pirate Navigation System - Quartermaster AI Chatbot
 * Autonomous Maritime NLP & Interactive UI Assistant
 * 
 * Allows users to type natural language commands to:
 * - Plot routes (e.g. "Plot route from Agatti to Minicoy at 14 knots")
 * - Declare hazards & storms (e.g. "Block Kavaratti atoll", "Declare storm on Suheli-Minicoy")
 * - Clear hazards and reset calm waters
 * - Inquire about atolls, nautical distances, and risk factors
 * All commands immediately trigger live visual changes on the Leaflet chart and UI!
 */

class QuartermasterAIChatbot {
  constructor() {
    this.isOpen = false;
    this.isVoiceEnabled = false;
    this.messages = [];
    this.speechSynth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  }

  init() {
    this.bindEvents();
    this.addGreeting();
  }

  bindEvents() {
    const fabBtn = document.getElementById('ai-chat-fab');
    const closeBtn = document.getElementById('ai-chat-close-btn');
    const voiceToggleBtn = document.getElementById('ai-voice-toggle-btn');
    const form = document.getElementById('ai-chat-form');
    const input = document.getElementById('ai-chat-input');
    const chips = document.querySelectorAll('.ai-chip');

    fabBtn?.addEventListener('click', () => this.toggleWindow());
    closeBtn?.addEventListener('click', () => this.closeWindow());

    voiceToggleBtn?.addEventListener('click', () => {
      this.isVoiceEnabled = !this.isVoiceEnabled;
      const icon = document.getElementById('ai-voice-icon');
      if (icon) icon.textContent = this.isVoiceEnabled ? '🔊' : '🔇';
      if (!this.isVoiceEnabled && this.speechSynth) {
        this.speechSynth.cancel();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeWindow();
      }
    });

    form?.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.handleUserInput(text);
    });

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          this.handleUserInput(prompt);
        }
      });
    });
  }

  toggleWindow() {
    this.isOpen = !this.isOpen;
    const windowEl = document.getElementById('ai-chat-window');
    const fabEl = document.getElementById('ai-chat-fab');

    if (this.isOpen) {
      windowEl?.classList.add('active');
      fabEl?.classList.add('chat-open');
      const input = document.getElementById('ai-chat-input');
      setTimeout(() => input?.focus(), 200);
      this.scrollToBottom();
    } else {
      windowEl?.classList.remove('active');
      fabEl?.classList.remove('chat-open');
    }
  }

  closeWindow() {
    this.isOpen = false;
    document.getElementById('ai-chat-window')?.classList.remove('active');
    document.getElementById('ai-chat-fab')?.classList.remove('chat-open');
  }

  addGreeting() {
    this.addMessage(
      'bot',
      `Ahoy, Captain! I be your <strong>Quartermaster AI Navigator</strong>. 🧭<br/><br/>
       Command me to chart courses, declare storms, or block sea lanes across Lakshadweep:
       <ul style="margin: 6px 0 6px 16px; padding: 0; font-size: 0.76rem; color: #ebd2ad;">
         <li><em>"Plot route from Agatti to Minicoy at 14 knots"</em></li>
         <li><em>"Block Kavaratti atoll"</em></li>
         <li><em>"Declare storm between Suheli Par and Minicoy"</em></li>
         <li><em>"Clear all hazards and reset calm seas"</em></li>
       </ul>
       What be yer orders for the voyage?`
    );
  }

  addMessage(sender, htmlContent, actionCard = null) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isBot = sender === 'bot';

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-chat-msg ${isBot ? 'bot' : 'user'}`;

    let cardHtml = '';
    if (actionCard) {
      cardHtml = `
        <div class="ai-action-card">
          <div class="ai-action-card-title">${actionCard.title}</div>
          <div class="ai-action-card-grid">
            <div class="ai-card-stat">
              <span class="ai-card-stat-label">Distance</span>
              <span class="ai-card-stat-val">${actionCard.distance || '--'}</span>
            </div>
            <div class="ai-card-stat">
              <span class="ai-card-stat-label">Days At Sea</span>
              <span class="ai-card-stat-val">${actionCard.time || '--'}</span>
            </div>
            <div class="ai-card-stat">
              <span class="ai-card-stat-label">Risk Hazard</span>
              <span class="ai-card-stat-val" style="color:${actionCard.riskColor || '#52b788'};">${actionCard.risk || '0%'}</span>
            </div>
            <div class="ai-card-stat">
              <span class="ai-card-stat-label">Trajectory</span>
              <span class="ai-card-stat-val" style="font-size:0.75rem;">${actionCard.waypoints || '--'}</span>
            </div>
          </div>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="ai-msg-bubble">
        ${htmlContent}
        ${cardHtml}
        <span class="ai-msg-time">${timeStr}</span>
      </div>
    `;

    container.appendChild(msgDiv);
    this.scrollToBottom();

    if (isBot && this.isVoiceEnabled) {
      // Strip HTML for speech
      const temp = document.createElement('div');
      temp.innerHTML = htmlContent;
      const textToSpeak = temp.textContent || temp.innerText || '';
      this.speakText(textToSpeak.slice(0, 180));
    }
  }

  speakText(text) {
    if (!this.speechSynth) return;
    this.speechSynth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.9; // Deep pirate quartermaster tone
    this.speechSynth.speak(utterance);
  }

  scrollToBottom() {
    const container = document.getElementById('ai-chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Process Natural Language Input & Execute UI Actions
   */
  async handleUserInput(userText) {
    this.addMessage('user', userText);

    const text = userText.toLowerCase();
    const coordinator = window.appCoordinator;
    if (!coordinator) {
      this.addMessage('bot', 'System is still hoisting sails. Please wait a moment, Captain.');
      return;
    }

    const islands = coordinator.islands || [];
    const routes = coordinator.routes || [];

    // 1. SPEED CHANGE COMMAND
    const speedMatch = text.match(/(?:speed|sail at|speed of|set speed to|knot|knots|kts)\s*(\d{1,2})/i) ||
      text.match(/(\d{1,2})\s*(?:knot|knots|kts)/i);
    let speedChanged = false;
    if (speedMatch) {
      const parsedSpeed = parseInt(speedMatch[1], 10);
      if (parsedSpeed >= 4 && parsedSpeed <= 30) {
        coordinator.speedKnots = parsedSpeed;
        const slider = document.getElementById('speed-slider');
        const display = document.getElementById('speed-display');
        if (slider) slider.value = parsedSpeed;
        if (display) display.textContent = `${parsedSpeed} KTS`;
        coordinator.updateTravelTime();
        speedChanged = true;
      }
    }

    // 2. CLEAR ALL HAZARDS COMMAND
    if (text.includes('clear all') || text.includes('calm sea') || text.includes('reset hazard') || text.includes('lift all')) {
      await coordinator.clearAllHazards();
      this.addMessage(
        'bot',
        '🌊 <strong>Archipelago Waters Cleared!</strong> All storms, blockades, and treacherous shoals have been lifted across Lakshadweep. Sea lanes restored to calm status.'
      );
      return;
    }

    // 3. HAZARD / BLOCKADE / STORM DECLARATION
    const isBlockAction = text.includes('block') || text.includes('close') || text.includes('barricade') || text.includes('blockade');
    const isStormAction = text.includes('storm') || text.includes('tempest') || text.includes('gale') || text.includes('monsoon');
    const isDangerousAction = text.includes('dangerous') || text.includes('shoal') || text.includes('reef') || text.includes('patrol');
    const isClearSpecific = text.includes('clear') || text.includes('unblock') || text.includes('open');

    if (isBlockAction || isStormAction || isDangerousAction || isClearSpecific) {
      const hazardType = isBlockAction ? 'Blocked' : isStormAction ? 'Storm-battered' : isDangerousAction ? 'Dangerous' : 'Clear';

      // Check if an atoll/island name is mentioned
      const matchedIsland = islands.find(isl => text.includes(isl.name.toLowerCase()));

      // Check if a strait is mentioned (e.g. between X and Y)
      const matchedStrait = routes.find(r => {
        const fromName = (r.fromIsland?.name || '').toLowerCase();
        const toName = (r.toIsland?.name || '').toLowerCase();
        return (text.includes(fromName) && text.includes(toName));
      });

      if (matchedStrait) {
        await coordinator.applyRouteHazardUpdate(matchedStrait._id, hazardType);
        const fromN = matchedStrait.fromIsland?.name || 'Atoll';
        const toN = matchedStrait.toIsland?.name || 'Atoll';

        let desc = `Strait between <strong>${fromN}</strong> and <strong>${toN}</strong> has been marked as <strong>${hazardType}</strong>!`;
        if (coordinator.currentPathResult?.isRerouted) {
          desc += `<br/>🛡️ Trajectory immediately rerouted sub-second around the hazard!`;
        } else if (!coordinator.currentPathResult?.path?.length) {
          desc += `<br/>⚠️ All viable passages are now completely blocked!`;
        }

        this.addMessage('bot', desc);
        return;
      }

      if (matchedIsland) {
        await coordinator.applyIslandHazardUpdate(matchedIsland._id, hazardType);
        let desc = `Atoll <strong>${matchedIsland.name}</strong> danger state set to <strong>${hazardType}</strong>!`;

        if (!coordinator.currentPathResult?.path?.length) {
          desc += `<br/>☠️ <strong>Warning:</strong> All viable paths to destination are completely blocked!`;
        } else if (coordinator.currentPathResult?.isRerouted) {
          desc += `<br/>🛡️ Sub-second recalculation: Course rerouted safely around ${matchedIsland.name}.`;
        }

        this.addMessage('bot', desc);
        return;
      }
    }

    // 4. ROUTE PLANNING COMMAND ("plot route from X to Y", "sail to Y from X", "X to Y")
    let originIsland = null;
    let targetIsland = null;

    // Search for patterns: "from [island]" and "to [island]"
    islands.forEach(isl => {
      const name = isl.name.toLowerCase();
      // Check for "from <name>"
      if (text.includes(`from ${name}`) || text.includes(`depart ${name}`) || text.includes(`start ${name}`) || text.includes(`origin ${name}`)) {
        originIsland = isl;
      }
      // Check for "to <name>"
      if (text.includes(`to ${name}`) || text.includes(`towards ${name}`) || text.includes(`destination ${name}`) || text.includes(`reach ${name}`)) {
        targetIsland = isl;
      }
    });

    // Fallback search: if pattern not explicitly with "from/to", find any two mentioned islands
    if (!originIsland || !targetIsland) {
      const mentioned = islands.filter(isl => text.includes(isl.name.toLowerCase()));
      if (mentioned.length >= 2) {
        // Assume first mentioned is origin, second is target
        originIsland = originIsland || mentioned[0];
        targetIsland = targetIsland || mentioned[1];
      } else if (mentioned.length === 1) {
        if (!targetIsland) targetIsland = mentioned[0];
      }
    }

    // If target is found:
    if (targetIsland) {
      if (!originIsland) {
        // Use current departure if set, else Agatti or Kavaratti
        if (coordinator.departureId && coordinator.departureId !== targetIsland._id) {
          originIsland = islands.find(i => String(i._id) === String(coordinator.departureId));
        } else {
          originIsland = islands.find(i => i.name.toLowerCase() !== targetIsland.name.toLowerCase());
        }
      }

      if (originIsland._id === targetIsland._id) {
        this.addMessage('bot', `Captain, departure and destination cannot be the same atoll (${targetIsland.name}). Pick two distinct atolls to sail between!`);
        return;
      }

      // Execute UI Updates
      coordinator.setDeparture(originIsland._id);
      coordinator.setDestination(targetIsland._id);
      await coordinator.plotCourse();

      const result = coordinator.currentPathResult;

      if (!result || !result.path || result.path.length === 0) {
        this.addMessage(
          'bot',
          `☠️ <strong>All Viable Routes Blocked!</strong><br/>
           No safe passage could be found between <strong>${originIsland.name}</strong> and <strong>${targetIsland.name}</strong>. The straits or atolls along the path are blocked by naval patrols or storms. Ye must lift a blockade to set sail!`
        );
        return;
      }

      const waypointNames = result.path.map(id => islands.find(i => String(i._id) === String(id))?.name || 'Atoll').join(' ➔ ');
      const riskPct = result.riskPercentage || 0;
      const riskColor = riskPct >= 50 ? '#ff4d6d' : riskPct > 0 ? '#ffb703' : '#52b788';

      let reply = `Aye, Captain! Trajectory plotted from <strong>${originIsland.name}</strong> to <strong>${targetIsland.name}</strong>`;
      if (speedChanged) reply += ` at <strong>${coordinator.speedKnots} knots</strong>`;
      reply += `. The chart has been updated live!`;

      if (result.isRerouted) {
        reply += `<br/>🛡️ <em>Notice: Trajectory detours around declared hazards to ensure vessel safety!</em>`;
      }

      this.addMessage('bot', reply, {
        title: `🧭 Course: ${originIsland.name} ➔ ${targetIsland.name}`,
        distance: `${result.totalDistance} NM`,
        time: result.estimatedDaysAtSea,
        risk: result.riskHazardFactor || `${riskPct}%`,
        riskColor,
        waypoints: waypointNames
      });
      return;
    }

    // 5. LIST ATOLLS / GENERAL INFO
    if (text.includes('list') || text.includes('atolls') || text.includes('islands') || text.includes('map')) {
      const atollList = islands.map(i => `<strong>${i.name}</strong> (${i.type || 'Atoll'})`).join(', ');
      this.addMessage(
        'bot',
        `🏝️ <strong>Lakshadweep Archipelago Network (12 Atolls):</strong><br/>${atollList}.<br/><br/>Ask me to plot a course between any of these, e.g. <em>"Plot from Agatti to Minicoy"</em>!`
      );
      return;
    }

    // 6. GENERAL MARITIME ASSISTANCE
    this.addMessage(
      'bot',
      `Captain, I hear yer words, but give me specific sailing orders! Try:<br/>
       • <em>"Plot route from Agatti to Minicoy at 12 knots"</em><br/>
       • <em>"Block Suheli Par"</em> or <em>"Storm on Kalpeni"</em><br/>
       • <em>"Clear all hazards"</em><br/>
       • <em>"List all atolls"</em>`
    );
  }
}

window.quartermasterAI = new QuartermasterAIChatbot();
document.addEventListener('DOMContentLoaded', () => {
  window.quartermasterAI.init();
});
