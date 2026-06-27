import React, { useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export type LatLng = { lat: number; lng: number };

interface Props {
  visible: boolean;
  initialPolygon?: LatLng[];
  zoneName?: string;
  onConfirm: (polygon: LatLng[]) => void;
  onClose: () => void;
}

const TABUK_LAT = 28.3998;
const TABUK_LNG = 36.5717;

function buildMapHtml(initialPoly: LatLng[]) {
  const polyJson = JSON.stringify(initialPoly);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body, #map { width:100%; height:100%; overflow:hidden; }
#toolbar {
  position:fixed; top:10px; left:50%; transform:translateX(-50%);
  display:flex; gap:8px; z-index:9999;
}
.tbtn {
  background:rgba(0,0,0,0.8); color:#E8920C;
  border:1px solid #E8920C; border-radius:16px;
  padding:6px 14px; font-size:13px; font-family:sans-serif;
  cursor:pointer; white-space:nowrap;
}
.tbtn:active { opacity:0.7; }
#hint {
  position:fixed; bottom:10px; left:50%; transform:translateX(-50%);
  background:rgba(0,0,0,0.75); color:#fff;
  padding:7px 16px; border-radius:18px;
  font-size:13px; font-family:sans-serif; text-align:center;
  pointer-events:none; z-index:9999; direction:rtl;
}
#count {
  position:fixed; top:10px; right:10px;
  background:rgba(200,23,26,0.85); color:#fff;
  border-radius:12px; padding:4px 10px;
  font-size:12px; font-family:monospace; z-index:9999;
}
</style>
</head>
<body>
<div id="map"></div>
<div id="toolbar">
  <button class="tbtn" onclick="undoLast()">↩ تراجع</button>
  <button class="tbtn" onclick="clearAll()">🗑️ مسح الكل</button>
</div>
<div id="count">0 نقطة</div>
<div id="hint">📍 اضغط على الخريطة لإضافة نقاط المنطقة</div>
<script>
var map = L.map('map', { zoomControl:true, attributionControl:false })
           .setView([${TABUK_LAT}, ${TABUK_LNG}], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

var points = [];
var markers = [];
var polyline = null;
var polygon = null;

function mkIcon(idx) {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;background:#E8920C;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:bold;box-shadow:0 1px 4px rgba(0,0,0,0.5)">' + (idx+1) + '</div>',
    iconSize:[20,20], iconAnchor:[10,10],
  });
}

function redraw() {
  if (polyline) { map.removeLayer(polyline); polyline = null; }
  if (polygon)  { map.removeLayer(polygon);  polygon  = null; }

  if (points.length >= 2) {
    polyline = L.polyline(points.map(p => [p.lat, p.lng]), { color:'#E8920C', weight:2, dashArray:'6,4' }).addTo(map);
  }
  if (points.length >= 3) {
    polygon = L.polygon(points.map(p => [p.lat, p.lng]), {
      color:'#E8920C', weight:2, fillColor:'#E8920C', fillOpacity:0.18,
    }).addTo(map);
  }

  document.getElementById('count').textContent = points.length + ' نقطة';
  document.getElementById('hint').textContent = points.length < 3
    ? '📍 اضغط لإضافة نقاط (3 على الأقل)'
    : '✅ ' + points.length + ' نقاط — اضغط تأكيد في الأعلى';

  sendUpdate();
}

function addPoint(lat, lng) {
  points.push({ lat, lng });
  var m = L.marker([lat, lng], { icon: mkIcon(points.length - 1), draggable: true }).addTo(map);
  var idx = points.length - 1;
  m.on('dragend', function(e) {
    var p = e.target.getLatLng();
    points[idx] = { lat: p.lat, lng: p.lng };
    redraw();
  });
  markers.push(m);
  redraw();
}

function undoLast() {
  if (!points.length) return;
  points.pop();
  var m = markers.pop();
  if (m) map.removeLayer(m);
  redraw();
}

function clearAll() {
  points = [];
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  redraw();
}

function sendUpdate() {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type:'polygon', points: points }));
  }
}

map.on('click', function(e) { addPoint(e.latlng.lat, e.latlng.lng); });

// Load initial polygon if any
var init = ${polyJson};
if (init && init.length >= 3) {
  init.forEach(function(p) { addPoint(p.lat, p.lng); });
  var lls = init.map(function(p) { return [p.lat, p.lng]; });
  map.fitBounds(L.polygon(lls).getBounds(), { padding: [30, 30] });
}
</script>
</body>
</html>`;
}

export function ZoneDrawerModal({ visible, initialPolygon, zoneName, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [points, setPoints] = useState<LatLng[]>(initialPolygon ?? []);
  const [mapReady, setMapReady] = useState(false);
  const webRef = useRef<WebView>(null);

  const html = buildMapHtml(initialPolygon ?? []);

  const handleMessage = (e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "polygon") setPoints(data.points ?? []);
    } catch {}
  };

  const canConfirm = points.length >= 3;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
            🗺️ {zoneName ? `رسم منطقة: ${zoneName}` : "رسم منطقة توصيل"}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Hint bar */}
        <View style={[s.hintBar, { backgroundColor: "#1A1A0A" }]}>
          <Feather name="info" size={13} color="#E8920C" />
          <Text style={{ color: "#E8920C", fontFamily: "Cairo_400Regular", fontSize: 12, flex: 1, textAlign: "right" }}>
            اضغط على الخريطة لإضافة نقاط الحدود · اسحب النقاط لضبطها
          </Text>
        </View>

        {/* Map */}
        <View style={{ flex: 1, position: "relative" }}>
          {!mapReady && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color="#E8920C" />
              <Text style={{ color: "#9A7A5A", marginTop: 10, fontFamily: "Cairo_400Regular" }}>جارٍ تحميل الخريطة...</Text>
            </View>
          )}
          <WebView
            ref={webRef}
            source={{ html }}
            style={{ flex: 1 }}
            onLoadEnd={() => setMapReady(true)}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mixedContentMode="always"
            originWhitelist={["*"]}
          />
        </View>

        {/* Footer */}
        <View style={[s.footer, { backgroundColor: colors.card, paddingBottom: insets.bottom + 10, borderTopColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "center", marginBottom: 8 }}>
            {points.length < 3
              ? `${points.length} نقطة — يلزم 3 على الأقل لإغلاق المنطقة`
              : `✅ ${points.length} نقاط — المنطقة جاهزة`}
          </Text>
          <TouchableOpacity
            onPress={() => canConfirm && onConfirm(points)}
            disabled={!canConfirm}
            style={[s.confirmBtn, { opacity: canConfirm ? 1 : 0.45 }]}
            activeOpacity={0.85}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Cairo_700Bold", fontSize: 16 }}>
              تأكيد المنطقة
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  closeBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15 },
  hintBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F0A05",
    zIndex: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  confirmBtn: {
    backgroundColor: "#C8171A",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
