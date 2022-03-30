/* eslint-disable @typescript-eslint/no-explicit-any */
import { Text } from 'theme-ui';
import { Dropzone } from '../dropzone.component';

export default {
  title: 'Components/Dropzone',
  parameters: {
    actions: {
      argTypesRegex: '^on.*'
    }
  }
};

export const StandardDropzone = ({ onDrop }: any) => {
  return (
    <Dropzone
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}
      onAcceptFiles={onDrop}
    >
      <Text>Drop something here</Text>
    </Dropzone>
  );
};
