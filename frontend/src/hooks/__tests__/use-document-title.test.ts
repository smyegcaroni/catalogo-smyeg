import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from '../use-document-title';

describe('useDocumentTitle', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it('sets document.title with the catalog name for a non-empty title', () => {
    renderHook(() => useDocumentTitle('Search'));
    expect(document.title).toBe('Search - Catálogo Geoespacial Cuenca Río Caroní');
  });

  it('sets document.title to the catalog name for an empty title', () => {
    renderHook(() => useDocumentTitle(''));
    expect(document.title).toBe('Catálogo Geoespacial Cuenca Río Caroní');
  });

  it('leaves document.title untouched for a nullish title', () => {
    document.title = 'Untouched - GeoLens';
    renderHook(() => useDocumentTitle(null));
    expect(document.title).toBe('Untouched - GeoLens');
  });
});
