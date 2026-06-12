import { profanityFilter } from '../../services/highchair/profanityFilter';

const SUPPORTED_EMOJIS = new Set(['👋', '👍', '👎', '👏', '😊', '😂', '😮', '😢', '😡', '❤️']);

export default class Nametag {
  private static _template: HTMLTemplateElement;

  public static initialize(): void {
    this._template = document.createElement('template');
    this._template.id = 'highchair-nametag-template';
    this._template.innerHTML = `
      <div class="highchair-nametag">
        <img src="/images/default-nametag-icon.jpg" class="highchair-nametag-picture" />
        <span class="highchair-nametag-emoji"></span>
        <div class="highchair-nametag-username-chat">
          <span class="highchair-nametag-username" no-translate></span>
          <span class="highchair-nametag-chat"></span>
        </div>
      </div>
    `;
    document.body.appendChild(this._template);

    this.register();
  }

  private static register(): void {
    window.highchair.registerSceneUITemplate('highchair:nametag', (_id, onState) => {
      const template = document.getElementById('highchair-nametag-template');
      const clone = (template as any).content.cloneNode(true);
      const nametag = clone.querySelector('.highchair-nametag') as HTMLElement;
      const nametagEmoji = clone.querySelector('.highchair-nametag-emoji') as HTMLElement;
      const nametagUsername = clone.querySelector('.highchair-nametag-username') as HTMLElement;
      const nametagProfilePicture = clone.querySelector('.highchair-nametag-picture') as HTMLImageElement;
      const nametagChat = clone.querySelector('.highchair-nametag-chat') as HTMLElement;

      let hideTimeout: ReturnType<typeof setTimeout>;

      const resetEmoji = () => {
        nametagEmoji.classList.remove('active', 'hiding');
        nametagEmoji.textContent = '';
      };

      const resetChat = () => {
        nametag.classList.remove('has-chat', 'hiding');
        nametagChat.textContent = '';
      };

      // Clear content after hide animation completes
      nametagEmoji.addEventListener('animationend', () => nametagEmoji.classList.contains('hiding') && resetEmoji());
      nametag.addEventListener('animationend', () => nametag.classList.contains('hiding') && resetChat());

      const showEmoji = (emoji: string) => {
        resetChat();
        nametagEmoji.classList.remove('hiding');
        nametagEmoji.textContent = emoji;
        nametagEmoji.classList.add('active');
      };

      const showChat = (chat: string) => {
        resetEmoji();
        nametag.classList.remove('hiding');
        nametagChat.textContent = profanityFilter.clean(chat);
        nametag.classList.add('has-chat');
      };

      onState((state: any) => {
        clearTimeout(hideTimeout);

        if (state.username) {
          nametagUsername.textContent = profanityFilter.clean(state.username);
        }
        
        if (state.profilePictureUrl) {
          nametagProfilePicture.src = state.profilePictureUrl;
        }

        if (SUPPORTED_EMOJIS.has(state.chat)) {
          showEmoji(state.chat);
          hideTimeout = setTimeout(() => nametagEmoji.classList.add('hiding'), 2000);
        } else if (state.chat) {
          showChat(state.chat);
          const timeout = Math.min(3000 + state.chat.length * 100, 10000);
          hideTimeout = setTimeout(() => nametag.classList.add('hiding'), timeout);
        } else {
          // No chat - just show username (clear any active chat/emoji)
          resetEmoji();
          resetChat();
        }
      });

      return clone;
    });
  }
}