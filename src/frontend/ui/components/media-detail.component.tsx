import { FC } from 'react';
import { BoxProps, Flex, Image } from 'theme-ui';
import { Asset } from '../../../common/asset.interfaces';

interface MediaDetailProps extends BoxProps {
  /** Asset to render details of */
  asset: Asset;
}

/**
 * Panel displayed when an asset is selected in a collection view and we want to show the its media in a side-area.
 */
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
