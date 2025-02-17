<?php declare(strict_types=1);
/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */

namespace Elabftw\Traits;

use Elabftw\Elabftw\TagParams;

/**
 * For inserting tags during creation
 */
trait InsertTagsTrait
{
    // insert the tags from the extraParams
    private function insertTags(array $tags, int $id): void
    {
        $newEntity = new self($this->Users, $id);
        foreach ($tags as $tag) {
            $newEntity->Tags->create(new TagParams($tag));
        }
    }
}
