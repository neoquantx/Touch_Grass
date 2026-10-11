import { Alert } from 'react-native';

export function confirmTwice({ title, firstMessage, secondMessage, confirmLabel }) {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      firstMessage,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { 
          text: 'Continue',
          onPress: () => {
            setTimeout(() => {
              Alert.alert(
                'Are you sure?',
                secondMessage,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) }
                ]
              );
            }, 100);
          }
        }
      ]
    );
  });
}
