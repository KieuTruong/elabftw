/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */
declare let ChemDoodle: any; // eslint-disable-line @typescript-eslint/no-explicit-any
import 'jquery-ui/ui/widgets/sortable';
import * as $3Dmol from '3dmol/build/3Dmol-nojquery.js';
import { CheckableItem, ResponseMsg } from './interfaces';
import { DateTime } from 'luxon';
import { EntityType, Entity } from './interfaces';
import { MathJaxObject } from 'mathjax-full/js/components/startup';
declare const MathJax: MathJaxObject;
import { Payload, Method, Model, Action, Target } from './interfaces';
import { Ajax } from './Ajax.class';

// get html of current page reloaded via get
function fetchCurrentPage(tag = ''): Promise<Document>{
  const url = new URL(window.location.href);
  if (tag) {
    url.searchParams.delete('tags[]');
    url.searchParams.set('tags[]', tag);
  }
  return fetch(url.toString()).then(response => {
    return response.text();
  }).then(data => {
    const parser = new DOMParser();
    return parser.parseFromString(data, 'text/html');
  });
}

// DISPLAY TIME RELATIVE TO NOW
// the datetime is taken from the title of the element so mouse hover will show raw datetime
export function relativeMoment(): void {
  const locale = document.getElementById('user-prefs').dataset.jslang;
  document.querySelectorAll('.relative-moment').forEach(el => {
    const span = el as HTMLElement;
    // do nothing if it's already loaded, prevent infinite loop with mutation observer
    if (span.innerText) {
      return;
    }
    span.innerText = DateTime.fromFormat(span.title, 'yyyy-MM-dd HH:mm:ss', {'locale': locale}).toRelative();
  });
}

// for view or edit mode, get type and id from the page to construct the entity object
export function getEntity(): Entity {
  if (!document.getElementById('info')) {
    return;
  }
  // holds info about the page through data attributes
  const about = document.getElementById('info').dataset;
  let entityType: EntityType;
  if (about.type === 'experiments') {
    entityType = EntityType.Experiment;
  }
  if (about.type === 'items') {
    entityType = EntityType.Item;
  }
  if (about.type === 'experiments_templates') {
    entityType = EntityType.Template;
  }
  if (about.type === 'items_types') {
    entityType = EntityType.ItemType;
  }
  let entityId = null;
  if (about.id) {
    entityId = parseInt(about.id);
  }
  return {
    type: entityType,
    id: entityId,
  };
}


// PUT A NOTIFICATION IN TOP LEFT WINDOW CORNER
export function notif(info: ResponseMsg): void {
  // clear an existing one
  if (document.getElementById('overlay')) {
    document.getElementById('overlay').remove();
  }

  const p = document.createElement('p');
  p.innerText = (info.msg as string);
  const result = info.res ? 'ok' : 'ko';
  const overlay = document.createElement('div');
  overlay.setAttribute('id','overlay');
  overlay.setAttribute('class', 'overlay ' + 'overlay-' + result);
  // show the overlay
  document.body.appendChild(overlay);
  // add text inside
  document.getElementById('overlay').appendChild(p);
  // wait a bit and make it disappear
  window.setTimeout(function() {
    $('#overlay').fadeOut(763, function() {
      $(this).remove();
    });
  }, 2733);
}

// DISPLAY 2D MOL FILES
export function displayMolFiles(): void {
  // loop all the mol files and display the molecule with ChemDoodle
  $.each($('.molFile'), function() {
    // id of the canvas to attach the viewer to
    const id = $(this).attr('id');
    // now get the file content and display it in the viewer
    ChemDoodle.io.file.content($(this).data('molpath'), function(fileContent: string){
      const mol = ChemDoodle.readMOL(fileContent);
      const viewer = new ChemDoodle.ViewerCanvas(id, 250, 250);
      // load it
      viewer.loadMolecule(mol);
    });
  });
}

// DISPLAY 3D MOL FILES
export function display3DMolecules(autoload = false): void {
  if (autoload) {
    $3Dmol.autoload();
  }
  // Top left menu to change the style of the displayed molecule
  $('.dropdown-item').on('click', '.3dmol-style', function() {
    const targetStyle = $(this).data('style');
    let options = {};
    const style = {};
    if (targetStyle === 'cartoon') {
      options = { color: 'spectrum' };
    }
    style[targetStyle] = options;

    $3Dmol.viewers[$(this).data('divid')].setStyle(style).render();
  });
}

// insert a get param in the url and reload the page
export function insertParamAndReload(key: string, value: string): void {
  const params = new URLSearchParams(document.location.search.slice(1));
  params.set(key, value);
  // reload the page
  document.location.search = params.toString();
}

// SORTABLE ELEMENTS
export function makeSortableGreatAgain(): void {
  // need an axis and a table via data attribute
  $('.sortable').sortable({
    // limit to horizontal dragging
    axis : $(this).data('axis'),
    helper : 'clone',
    handle : '.sortableHandle',
    // we don't want the Create new pill to be sortable
    cancel: 'nonSortable',
    // do ajax request to update db with new order
    update: function() {
      // send the order as an array
      const ordering = $(this).sortable('toArray');
      $.post('app/controllers/SortableAjaxController.php', {
        table: $(this).data('table'),
        ordering: ordering,
      }).done(function(json) {
        notif(json);
      });
    },
  });
}

export function getCheckedBoxes(): Array<CheckableItem> {
  const checkedBoxes = [];
  $('.item input[type=checkbox]:checked').each(function() {
    checkedBoxes.push({
      id: parseInt($(this).data('id')),
      // the randomid is used to get the parent container and hide it when delete
      randomid: parseInt($(this).data('randomid')),
    });
  });
  return checkedBoxes;
}

// reload the entities in show mode
export async function reloadEntitiesShow(tag = ''): Promise<void | Response> {
  // get the html
  const html = await fetchCurrentPage(tag);
  // reload items
  document.getElementById('showModeContent').innerHTML = html.getElementById('showModeContent').innerHTML;
  // also reload any pinned entities present
  if (document.getElementById('pinned-entities')) {
    document.getElementById('pinned-entities').innerHTML = html.getElementById('pinned-entities').innerHTML;
  }
  // ask mathjax to reparse the page
  MathJax.typeset();
  // rebind autocomplete for links input
  addAutocompleteToLinkInputs();
  // tags too
  addAutocompleteToTagInputs();
}

export async function reloadElement(elementId): Promise<void> {
  if (!document.getElementById(elementId)) {
    console.error('Could not find element to reload!');
    return;
  }
  const html = await fetchCurrentPage();
  document.getElementById(elementId).innerHTML = html.getElementById(elementId).innerHTML;
}

/**
 * All elements that have a save-hidden data attribute have their visibility depend on the saved state
 * in localStorage. The localStorage key is the value of the save-hidden data attribute.
 */
export function adjustHiddenState(): void {
  document.querySelectorAll('[data-save-hidden]').forEach(el => {
    const localStorageKey = (el as HTMLElement).dataset.saveHidden + '-isHidden';
    if (localStorage.getItem(localStorageKey) === '1') {
      el.setAttribute('hidden', 'hidden');
    // make sure to explicitely check for the value, because the key might not exist!
    } else if (localStorage.getItem(localStorageKey) === '0') {
      el.removeAttribute('hidden');
    }
  });
}

// AUTOCOMPLETE
export function addAutocompleteToLinkInputs(): void {
  let cache = {};
  // this is the select category filter on add link input
  const catFilterEl = (document.getElementById('addLinkCatFilter') as HTMLInputElement);
  if (catFilterEl) {
    // when we change the category filter, reset the cache
    catFilterEl.addEventListener('change', () => {
      cache = {};
    });
    ($('[data-autocomplete="links"]') as JQuery<HTMLInputElement>).autocomplete({
      source: function(request: Record<string, string>, response: (data) => void): void {
        const term = request.term;
        if (term in cache) {
          response(cache[term]);
          return;
        }
        // TODO use AjaxC as for tags below
        $.getJSON(`app/controllers/EntityAjaxController.php?source=items&filter=${catFilterEl.value}`, request, function(data) {
          cache[term] = data;
          response(data);
        });
      },
    });
  }
}

export function addAutocompleteToTagInputs(): void {
  const cache = {};
  const AjaxC = new Ajax();
  const entity = getEntity();
  ($('[data-autocomplete="tags"]') as JQuery<HTMLInputElement>).autocomplete({
    source: function(request: Record<string, string>, response: (data) => void): void {
      const term  = request.term;
      if (term in cache) {
        response(cache[term]);
        return;
      }
      const payload: Payload = {
        method: Method.GET,
        action: Action.Read,
        model: Model.Tag,
        entity: entity,
        target: Target.List,
        content: term,
      };
      AjaxC.send(payload).then(json => {
        cache[term] = json.value;
        response(json.value);
      });
    },
  });
}

// used in edit.ts to build search patterns from strings that contain special characters
// taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(string: string): string {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
