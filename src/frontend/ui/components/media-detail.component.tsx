import { FC } from 'react';
import { BoxProps, Flex, Image } from 'theme-ui';
import { Asset } from '../../../common/asset.interfaces';

interface MediaDetailProps extends BoxProps {
  asset: Asset;
}

export const MediaDetail: FC<MediaDetailProps> = ({ asset, ...props }) => {
  const media = asset.media;

  return (
    <Flex
      sx={{
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: 3
      }}
      {...props}
    >
      {media.map((item) => (
        <Image
          sx={{ '&:not(:first-of-type)': { mt: 3 } }}
          key={item.id}
          src={item.rendition}
        />
      ))}
    </Flex>
  );
};
