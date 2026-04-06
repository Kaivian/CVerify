import { type NotificationRenderer, type NotificationEvent } from '../types';
import { toast } from '@heroui/react';

/**
 * Concrete renderer binding NotificationHub abstract events to existing HeroUI Toast singletons.
 * Ensures the visual design, animations, colors, and layout remain completely unchanged.
 */
export class HeroUIToastRenderer implements NotificationRenderer {
  render(event: NotificationEvent) {
    const options = {
      description: event.description,
      // Clear event tracking cleanly upon dismiss/timeout
      onClose: () => {
        // Optional tracking lifecycle hook
      }
    };

    switch (event.category) {
      case 'success':
        toast.success(event.title, options);
        break;
      case 'warning':
        toast.warning(event.title, options);
        break;
      case 'error':
        toast.danger(event.title, options);
        break;
      case 'info':
      default:
        toast.info(event.title, options);
        break;
    }
  }

  clearAll() {
    if (toast && typeof toast.clear === 'function') {
      toast.clear();
    }
  }
}
