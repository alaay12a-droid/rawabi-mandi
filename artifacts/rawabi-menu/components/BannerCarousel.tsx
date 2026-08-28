import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, FlatList, Text, Dimensions,
  StyleSheet, Animated, Easing,
} from "react-native";
import { Image } from "expo-image";
import type { ApiBanner } from "@/hooks/useBanners";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH  = SW - 32;
const CARD_HEIGHT = 160;
const ENTRY_MS    = 450; // entry animation duration

// Total expanded height = card + optional dots row (marginTop 8 + dot height 6 + gap ≈ 24)
const EXPANDED_H = (withDots: boolean) => CARD_HEIGHT + (withDots ? 24 : 0);

interface Props { banners: ApiBanner[] }

export function BannerCarousel({ banners }: Props) {
  const active = banners.filter((b) => b.active);
  const flatRef    = useRef<FlatList>(null);
  const [current, setCurrent] = useState(0);
  const currentRef  = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Entry animation values ───────────────────────────────────────────────
  const heightAnim  = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // ── Auto-scroll (unchanged logic) ────────────────────────────────────────
  const scrollToIndex = useCallback((index: number) => {
    flatRef.current?.scrollToOffset({ offset: index * CARD_WIDTH, animated: true });
    setCurrent(index);
    currentRef.current = index;
  }, []);

  const startAutoScroll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const next = (currentRef.current + 1) % active.length;
      scrollToIndex(next);
    }, 4000);
  }, [active.length, scrollToIndex]);

  // ── Entry animation → then start auto-scroll ──────────────────────────────
  // The menu mounts this component before its async banner request completes.
  // Re-run when the active banner count changes so a first empty render cannot
  // leave the carousel permanently at height/opacity 0.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (active.length === 0) {
      heightAnim.stopAnimation();
      opacityAnim.stopAnimation();
      heightAnim.setValue(0);
      opacityAnim.setValue(0);
      currentRef.current = 0;
      setCurrent(0);
      return;
    }

    heightAnim.stopAnimation();
    opacityAnim.stopAnimation();
    heightAnim.setValue(0);
    opacityAnim.setValue(0);
    currentRef.current = 0;
    setCurrent(0);
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });

    // 1. Expand height + fade in (ease-out, 450ms)
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: EXPANDED_H(active.length > 1),
        duration: ENTRY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // height cannot use native driver
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: ENTRY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      // 2. Auto-scroll begins ONLY after entry animation finishes
      if (finished && active.length > 1) startAutoScroll();
    });

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active.length, heightAnim, opacityAnim, startAutoScroll]);

  if (active.length === 0) return null;

  return (
    // Animated.View controls height & opacity — pushes content below it down
    <Animated.View
      style={[
        styles.wrapper,
        { height: heightAnim, opacity: opacityAnim, overflow: "hidden" },
      ]}
    >
      <FlatList
        ref={flatRef}
        data={active}
        keyExtractor={(b) => String(b.bannerId)}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        snapToInterval={CARD_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
        onScrollBeginDrag={() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setCurrent(idx);
          currentRef.current = idx;
          if (active.length > 1) startAutoScroll();
        }}
        style={{ width: CARD_WIDTH }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: CARD_WIDTH }]}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.img}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={300}
            />
            {item.title ? (
              <View style={styles.overlay}>
                <Text style={styles.title}>{item.title}</Text>
              </View>
            ) : null}
          </View>
        )}
      />

      {active.length > 1 && (
        <View style={styles.dots}>
          {active.map((_, i) => (
            <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    alignItems: "center",
  },
  slide: {
    borderRadius: 18,
    overflow: "hidden",
    height: CARD_HEIGHT,
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  overlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#00000088",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: "#5A3A1A",
  },
  dotActive: {
    backgroundColor: "#C9863A",
    width: 18,
  },
});
