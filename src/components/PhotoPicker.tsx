import { useEffect, useState } from 'react';
import { api, getUploadsBase, MediaItem, PexelsPhoto } from '../api/client';
import Modal from './Modal';
import { useT } from '../i18n';

type Props = {
  value: string;
  onChange: (path: string) => void;
  suggestedQuery?: string;
  label?: string;
};

type Tab = 'library' | 'pexels' | 'upload';

export default function PhotoPicker({
  value,
  onChange,
  suggestedQuery = '',
  label,
}: Props) {
  const { t } = useT();
  const labelText = label || t('cat.photo');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('library');
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState(suggestedQuery);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);

  const uploads = getUploadsBase();
  const previewSrc = value ? `${uploads}/${value}` : '';

  const loadLibrary = async () => {
    const items = await api.getMediaLibrary();
    setLibrary(items);
  };

  useEffect(() => {
    if (!open) return;
    setQuery(suggestedQuery);
    setError(null);
    loadLibrary().catch((err) => setError(err.message));
    api
      .getSettings()
      .then((s) => setHasKey(Boolean(s.settings.pexels_api_key)))
      .catch(() => undefined);
  }, [open, suggestedQuery]);

  const searchPexels = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.searchPexels(query.trim() || suggestedQuery || 'product');
      setPhotos(result.photos);
      if (!result.photos.length) setError(t('photo.notFound'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('photo.searchFailed'));
      setPhotos([]);
    } finally {
      setBusy(false);
    }
  };

  const downloadPhoto = async (photo: PexelsPhoto) => {
    setBusy(true);
    setError(null);
    try {
      const item = await api.downloadPexels({
        photoId: photo.id,
        imageUrl: photo.download,
        photographer: photo.photographer,
        alt: photo.alt,
      });
      await loadLibrary();
      onChange(item.path);
      setTab('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('photo.downloadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const item = await api.uploadMedia(file);
      await loadLibrary();
      onChange(item.path);
      setTab('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('photo.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeFromLibrary = async (id: number) => {
    if (!confirm(t('photo.remove'))) return;
    await api.deleteMedia(id);
    await loadLibrary();
  };

  return (
    <div className="field">
      <label>{labelText}</label>
      <div className="photo-picker-row">
        <div className={`photo-preview ${value ? '' : 'empty'}`}>
          {value ? <img src={previewSrc} alt="" /> : <span>{t('photo.none')}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            {t('photo.choose', { label: labelText })}
          </button>
          {value && (
            <button type="button" className="btn" onClick={() => onChange('')}>
              {t('photo.clear')}
            </button>
          )}
        </div>
      </div>

      <Modal
        title={t('photo.library')}
        open={open}
        onClose={() => setOpen(false)}
        wide
        footer={
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            {t('common.done')}
          </button>
        }
      >
        <div className="chips" style={{ padding: 0, border: 0, marginBottom: '0.85rem' }}>
          <button
            type="button"
            className={`chip ${tab === 'library' ? 'active' : ''}`}
            onClick={() => setTab('library')}
          >
            {t('photo.tabLibrary')}
          </button>
          <button
            type="button"
            className={`chip ${tab === 'pexels' ? 'active' : ''}`}
            onClick={() => setTab('pexels')}
          >
            Pexels
          </button>
          <button
            type="button"
            className={`chip ${tab === 'upload' ? 'active' : ''}`}
            onClick={() => setTab('upload')}
          >
            {t('photo.tabUpload')}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {tab === 'library' && (
          <div className="media-grid">
            {library.map((item) => (
              <div
                key={item.id}
                className={`media-tile ${value === item.path ? 'selected' : ''}`}
                onClick={() => onChange(item.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onChange(item.path);
                }}
                role="button"
                tabIndex={0}
              >
                <img src={`${uploads}/${item.path}`} alt={item.alt || ''} />
                <span>{item.source === 'pexels' ? 'Pexels' : t('photo.tabUpload')}</span>
                <button
                  type="button"
                  className="media-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromLibrary(item.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {!library.length && (
              <div className="empty">{t('photo.emptyLibrary')}</div>
            )}
          </div>
        )}

        {tab === 'pexels' && (
          <div>
            {!hasKey && (
              <div className="notice">
                {t('photo.needKey')}
              </div>
            )}
            <div className="filters">
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                <label>{t('photo.search')}</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') searchPexels();
                  }}
                  placeholder={suggestedQuery || t('photo.searchPlaceholder')}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={searchPexels}
                disabled={busy || !hasKey}
              >
                {busy ? t('common.loading') : t('photo.search')}
              </button>
            </div>
            <div className="media-grid">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="media-tile"
                  disabled={busy}
                  onClick={() => downloadPhoto(photo)}
                  title={t('photo.by', { name: photo.photographer })}
                >
                  <img src={photo.preview} alt={photo.alt} />
                  <span>{t('common.save')} · {photo.photographer}</span>
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
              {t('set.pexelsHelp')}
            </p>
          </div>
        )}

        {tab === 'upload' && (
          <div className="field">
            <label>{t('photo.pickFile')}</label>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
